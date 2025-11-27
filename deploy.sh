#!/bin/bash
#
# This script mimics the behavior of the .github/workflows/deploy-to-cloud-run.yaml workflow.
# It deploys a service to Google Cloud Run.
#

# Exit immediately if a command exits with a non-zero status.
# Treat unset variables as an error.
# The return value of a pipeline is the status of the last command to exit with a non-zero status.
set -euo pipefail

# Required environment variables
REQUIRED_VARS=(
    "ARTIFACT_REGISTRY_REGION"
    "ARTIFACT_REGISTRY_PROJECT_ID"
    "ARTIFACT_REGISTRY_REPOSITORY_NAME"
    "GCP_PROJECT"
    "BQ_GOOGLE_PROJECT_ID"
    "GCP_LOCATION"
)

# --- Helper Functions ---
usage() {
    echo "Usage: $0 --release-tag <tag> --service-name <name> [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --release-tag <tag>          The release tag (docker container tag, e.g., git hash). (Required)"
    echo "  --service-name <name>        The Cloud Run service name (e.g., ma). (Required)"
    echo "  --config-file <file>         The YAML configuration file to use for deployment. (Default: cloudrun-service.yaml)"
    echo "  --dry-run                    Perform all steps except the actual deployment. Shows what would be deployed."
    echo "  -h, --help                   Display this help message."
}

# --- Argument Parsing ---
RELEASE_TAG=""
SERVICE_NAME=""
CONFIG_FILE="cloudrun-service.yaml"
DRY_RUN=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --release-tag) RELEASE_TAG="$2"; shift ;;
        --service-name) SERVICE_NAME="$2"; shift ;;
        --config-file) CONFIG_FILE="$2"; shift ;;
        --dry-run) DRY_RUN=true ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown parameter passed: $1"; usage; exit 1 ;;
    esac
    shift
done

# --- Validation ---
if [ -z "$RELEASE_TAG" ]; then
  echo "Error: --release-tag is required." >&2
  usage
  exit 1
fi

if [ -z "$SERVICE_NAME" ]; then
  echo "Error: --service-name is required." >&2
  usage
  exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Configuration file '$CONFIG_FILE' does not exist." >&2
  usage
  exit 1
fi

# --- Environment Variables ---
# Source .env file if it exists
if [ -f ".env" ]; then
    echo "INFO: Loading environment variables from .env file..."
    set -a  # Automatically export all variables
    source .env
    set +a  # Disable automatic export
    echo "INFO: Environment variables loaded from .env"
else
    echo "INFO: No .env file found. Using existing environment variables."
fi

# Add RELEASE_TAG to required vars for validation
REQUIRED_VARS+=("RELEASE_TAG")

# Validate required variables
echo "INFO: Validating required environment variables..."
missing_vars=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "ERROR: Missing required environment variables:" >&2
    for var in "${missing_vars[@]}"; do
        echo "  - $var" >&2
    done
    echo "Please set these variables in your environment or create a .env file." >&2
    exit 1
fi

echo "INFO: All required environment variables are set."

# --- Dependency Checks ---
command -v gcloud >/dev/null 2>&1 || { echo >&2 "I require gcloud but it's not installed. Please install Google Cloud SDK."; exit 1; }

# Check for envsubst or docker as fallback
if ! command -v envsubst >/dev/null 2>&1; then
    if ! command -v docker >/dev/null 2>&1; then
        echo >&2 "I require either 'envsubst' (from gettext package) or 'docker' for template substitution."
        if [[ "$(uname)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
            echo >&2 "You can install envsubst with: brew install gettext"
        elif [[ "$(uname)" == "Linux" ]]; then
            echo >&2 "You can install envsubst with: apt-get install gettext (Ubuntu/Debian) or yum install gettext (CentOS/RHEL)"
        fi
        echo >&2 "Alternatively, install Docker for the fallback option."
        exit 1
    else
        echo "INFO: envsubst not found, will use Docker fallback for template substitution."
    fi
fi
if ! command -v yq >/dev/null 2>&1; then
    echo "yq is not installed. It is required for merging YAML configurations."
    if [[ "$(uname)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
        echo "You can install it with: brew install yq"
    else
        echo "Please install it from here: https://github.com/mikefarah/yq/"
    fi
    exit 1
fi


# --- Main script ---
main() {
    echo "--- Deployment Configuration ---"
    echo "GCP Project: $GCP_PROJECT"
    echo "Cloud Run Service: $SERVICE_NAME"
    echo "Cloud Run Location: $GCP_LOCATION"
    echo "Artifact Registry Region: $ARTIFACT_REGISTRY_REGION"
    echo "Artifact Registry Project ID: $ARTIFACT_REGISTRY_PROJECT_ID"
    echo "Artifact Registry Repository: $ARTIFACT_REGISTRY_REPOSITORY_NAME"
    echo "Release Tag: $RELEASE_TAG"
    echo "Config File: $CONFIG_FILE"
    if [ "$DRY_RUN" = true ]; then
        echo "Mode: DRY RUN (no actual deployment will occur)"
    else
        echo "Mode: DEPLOY (will deploy to Cloud Run)"
    fi
    echo "--------------------------------"

    echo "INFO: Checking GCP authentication..."
    if ! gcloud auth print-access-token --quiet >/dev/null 2>&1; then
        echo "ERROR: You are not authenticated with gcloud." >&2
        echo "Please run 'gcloud auth login' and 'gcloud auth application-default login' to authenticate." >&2
        exit 1
    fi
    echo "INFO: gcloud authentication looks good."

    echo "INFO: Generating cloudrun-service-updates.yaml..."
    # Export variables for envsubst
    export ARTIFACT_REGISTRY_REGION
    export ARTIFACT_REGISTRY_PROJECT_ID
    export ARTIFACT_REGISTRY_REPOSITORY_NAME
    export RELEASE_TAG

    
    # Use native envsubst (much lighter than Python)
    if command -v envsubst >/dev/null 2>&1; then
        envsubst < "$CONFIG_FILE" > cloudrun-service-updates.yaml
    else
        echo "INFO: envsubst not found, using Docker alternative..."
        docker run --rm -i \
            -v "$(pwd)":/app \
            -e ARTIFACT_REGISTRY_REGION="$ARTIFACT_REGISTRY_REGION" \
            -e ARTIFACT_REGISTRY_PROJECT_ID="$ARTIFACT_REGISTRY_PROJECT_ID" \
            -e ARTIFACT_REGISTRY_REPOSITORY_NAME="$ARTIFACT_REGISTRY_REPOSITORY_NAME" \
            -e RELEASE_TAG="$RELEASE_TAG" \
            alpine:latest sh -c 'apk add --no-cache gettext && envsubst' < "$CONFIG_FILE" > cloudrun-service-updates.yaml
    fi

    echo "INFO: Fetching current Cloud Run service configuration..."
    if ! gcloud run services describe "$SERVICE_NAME" \
        --project="$GCP_PROJECT" \
        --region="$GCP_LOCATION" \
        --format=export > cloudrun-service-current.yaml; then
        echo "WARN: Could not fetch current service. This is expected if the service does not exist yet. Creating new service from scratch."
        # Create an empty file so the merge step doesn't fail
        cp cloudrun-service-updates.yaml cloudrun-service-current.yaml
    fi


    echo "INFO: Merging service configurations..."
    yq eval-all 'select(fileIndex == 0) * select(fileIndex == 1) | del(.spec.template.spec.containers)' cloudrun-service-current.yaml cloudrun-service-updates.yaml > cloudrun-service-new.yaml
    yq eval '.spec.template.spec.containers = load("cloudrun-service-updates.yaml").spec.template.spec.containers' -i cloudrun-service-new.yaml

    echo "--- Final Merged Configuration ---"
    cat cloudrun-service-new.yaml
    echo "----------------------------------"

    if [ "$DRY_RUN" = true ]; then
        echo "DRY RUN: Configuration generated successfully. No deployment will occur."
        echo "To deploy this configuration, run the script without --dry-run flag."
    else
        read -p "Do you want to deploy this configuration to Cloud Run? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "INFO: Deploying to Cloud Run..."
            gcloud run services replace cloudrun-service-new.yaml \
                --project="$GCP_PROJECT" \
                --region="$GCP_LOCATION"
            echo "INFO: Deployment complete."
        else
            echo "INFO: Deployment cancelled by user."
        fi
    fi

    # --- Cleanup ---
    # We use a trap to ensure cleanup happens even if the script fails
}

# --- Cleanup Function ---
cleanup() {
    echo "INFO: Cleaning up temporary files..."
    rm -f cloudrun-service-updates.yaml cloudrun-service-current.yaml cloudrun-service-new.yaml
}

# Trap EXIT signal to run cleanup function
trap cleanup EXIT

# Run the main function
main