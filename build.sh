#!/bin/bash

set -e  # Exit on any error

# Script to build Docker images for ma project and optionally upload to GCP Artifact Registry
# Usage: ./build.sh [--upload]

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to cleanup buildx builder on exit
cleanup_builder() {
    if [ -n "$BUILDER_NAME" ] && [ "$BUILDER_NAME" != "default" ]; then
        print_step "Cleaning up buildx builder..."
        docker buildx use default > /dev/null 2>&1 || true
        docker buildx rm "$BUILDER_NAME" > /dev/null 2>&1 || true
        print_success "Buildx builder cleaned up"
    fi
}

# Set up trap to cleanup on exit
trap cleanup_builder EXIT

print_help() {
    echo "Usage: $0 [--upload] [--release-tag <tag>] [--cache-from <spec>] [--cache-to <spec>]"
    echo "  --upload: Upload images to GCP Artifact Registry"
    echo "  --release-tag <tag>: The release tag (docker container tag, e.g., git hash)"
    echo "  --cache-from <spec>: Cache import specification for buildx (can be used multiple times)"
    echo "  --cache-to <spec>: Cache export specification for buildx (can be used multiple times)"
    echo "  Example cache specs:"
    echo "    --cache-from type=registry,ref=myregistry/cache:latest"
    echo "    --cache-to type=registry,ref=myregistry/cache:latest,mode=max"
    exit 0
}

# Parse command line arguments
UPLOAD=false
RELEASE_TAG=""
CACHE_FROM_ARGS=()
CACHE_TO_ARGS=()

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --upload)
            UPLOAD=true
            ;;
        --release-tag=*)
            RELEASE_TAG="${1#*=}"
            ;;
        --release-tag)
            if [ -z "$2" ]; then
                print_error "Error: --release-tag requires an argument"
                print_help
                exit 1
            fi
            RELEASE_TAG="$2"
            shift
            ;;
        --cache-from=*)
            CACHE_FROM_ARGS+=("--cache-from=${1#*=}")
            ;;
        --cache-from)
            if [ -z "$2" ]; then
                print_error "Error: --cache-from requires an argument"
                print_help
                exit 1
            fi
            CACHE_FROM_ARGS+=("--cache-from=$2")
            shift
            ;;
        --cache-to=*)
            CACHE_TO_ARGS+=("--cache-to=${1#*=}")
            ;;
        --cache-to)
            if [ -z "$2" ]; then
                print_error "Error: --cache-to requires an argument"
                print_help
                exit 1
            fi
            CACHE_TO_ARGS+=("--cache-to=$2")
            shift
            ;;
        -h|--help)
            print_help
            ;;
        *)
            print_error "Unknown argument: $1"
            echo "Usage: $0 [--upload] [--release-tag <tag>] [--cache-from <spec>] [--cache-to <spec>]"
            exit 1
            ;;
    esac
    shift
done

# Required environment variables (same as cloudrun-service.yaml)
REQUIRED_VARS=(
    "ARTIFACT_REGISTRY_REGION"
    "ARTIFACT_REGISTRY_PROJECT_ID"
    "ARTIFACT_REGISTRY_REPOSITORY_NAME"
    "RELEASE_TAG"
)

# Source .env file if it exists
if [ -f ".env" ]; then
    print_step "Loading environment variables from .env file..."
    set -a  # Automatically export all variables
    source .env
    set +a  # Disable automatic export
    print_success "Environment variables loaded from .env"
else
    print_warning "No .env file found. Make sure environment variables are set."
fi

# Validate required variables for upload
if [ "$UPLOAD" = true ]; then
    print_step "Validating environment variables for upload..."
    missing_vars=()

    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_error "Missing required environment variables for upload:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        print_warning "Set these variables or run without --upload flag"
        exit 1
    fi
    
    print_success "Environment variables validated"
fi

# Define image names
REGISTRY_BASE="$ARTIFACT_REGISTRY_REGION-docker.pkg.dev/$ARTIFACT_REGISTRY_PROJECT_ID/$ARTIFACT_REGISTRY_REPOSITORY_NAME"
FRONTEND_IMAGE="shiny-frontend:$RELEASE_TAG"
NGINX_IMAGE="shiny-nginx:$RELEASE_TAG"

# Define full registry image names for upload
FRONTEND_REGISTRY_IMAGE="$REGISTRY_BASE/shiny-frontend:$RELEASE_TAG"
NGINX_REGISTRY_IMAGE="$REGISTRY_BASE/shiny-nginx:$RELEASE_TAG"

# Print configuration
print_step "Build configuration:"
echo "  Release Tag: $RELEASE_TAG"
echo "  Upload: $UPLOAD"
if [ ${#CACHE_FROM_ARGS[@]} -gt 0 ]; then
    echo "  Cache From: ${CACHE_FROM_ARGS[*]}"
fi
if [ ${#CACHE_TO_ARGS[@]} -gt 0 ]; then
    echo "  Cache To: ${CACHE_TO_ARGS[*]}"
fi
if [ "$UPLOAD" = true ]; then
    echo "  Registry Region: $ARTIFACT_REGISTRY_REGION"
    echo "  Project ID: $ARTIFACT_REGISTRY_PROJECT_ID"
    echo "  Repository: $ARTIFACT_REGISTRY_REPOSITORY_NAME"
    echo "  Registry Base: $REGISTRY_BASE"
fi
echo ""

# Function to build Docker image
build_image() {
    local context=$1
    local dockerfile=$2
    local image_name=$3
    local description=$4
    
    print_step "Building $description..."
    echo "  Context: $context"
    echo "  Dockerfile: $dockerfile"
    echo "  Image: $image_name"
    
    # Build the docker buildx command with cache options
    buildx_cmd=("docker" "buildx" "build" "--platform" "linux/amd64" "-t" "$image_name" "-f" "$dockerfile")
    
    # Add cache-from arguments if specified
    if [ ${#CACHE_FROM_ARGS[@]} -gt 0 ]; then
        buildx_cmd+=("${CACHE_FROM_ARGS[@]}")
    fi
    
    # Add cache-to arguments if specified
    if [ ${#CACHE_TO_ARGS[@]} -gt 0 ]; then
        buildx_cmd+=("${CACHE_TO_ARGS[@]}")
    fi
    
    # Add remaining arguments
    buildx_cmd+=("$context" "--load" "--builder" "$BUILDER_NAME")
    
    if "${buildx_cmd[@]}"; then
        print_success "$description built successfully"
    else
        print_error "Failed to build $description"
        exit 1
    fi
    echo ""
}

# Function to tag and push image
upload_image() {
    local local_image=$1
    local registry_image=$2
    local description=$3
    
    print_step "Uploading $description..."
    echo "  Local: $local_image"
    echo "  Remote: $registry_image"
    
    # Tag the image for the registry
    if docker tag "$local_image" "$registry_image"; then
        print_success "Tagged $description for registry"
    else
        print_error "Failed to tag $description"
        exit 1
    fi
    
    # Push the image
    if docker push "$registry_image"; then
        print_success "$description uploaded successfully"
    else
        print_error "Failed to upload $description"
        exit 1
    fi
    echo ""
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Buildx is available and set up
print_step "Setting up Docker Buildx..."
if ! docker buildx version > /dev/null 2>&1; then
    print_error "Docker Buildx is not available. Please ensure Docker Desktop is up to date or install Buildx."
    exit 1
fi

# Create or use existing buildx builder
BUILDER_NAME="shiny-builder"
if ! docker buildx inspect "$BUILDER_NAME" > /dev/null 2>&1; then
    print_step "Creating new buildx builder: $BUILDER_NAME"
    if docker buildx create --name "$BUILDER_NAME" --driver docker-container --bootstrap > /dev/null 2>&1; then
        print_success "Buildx builder '$BUILDER_NAME' created successfully"
    else
        print_warning "Failed to create dedicated builder, using default builder"
        BUILDER_NAME="default"
    fi
else
    print_success "Using existing buildx builder: $BUILDER_NAME"
fi

# Use the builder
if docker buildx use "$BUILDER_NAME" > /dev/null 2>&1; then
    print_success "Docker Buildx configured successfully"
else
    print_error "Failed to configure Docker Buildx"
    exit 1
fi

print_step "Starting Docker builds..."
echo ""

# Build frontend image (Next.js)
build_image "." "./Dockerfile" "$FRONTEND_IMAGE" "Frontend"

# Build nginx image
build_image "./nginx" "./nginx/Dockerfile" "$NGINX_IMAGE" "Nginx"

print_success "All images built successfully!"
echo ""

# Upload images if requested
if [ "$UPLOAD" = true ]; then
    print_step "Starting upload to GCP Artifact Registry..."
    echo ""
    
    # Check if gcloud is authenticated
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        print_error "No active gcloud authentication found."
        print_warning "Please run: gcloud auth login"
        exit 1
    fi
    
    # Configure docker to use gcloud as credential helper for artifact registry
    print_step "Configuring Docker for Artifact Registry..."
    if gcloud auth configure-docker "$ARTIFACT_REGISTRY_REGION-docker.pkg.dev" --quiet; then
        print_success "Docker configured for Artifact Registry"
    else
        print_error "Failed to configure Docker for Artifact Registry"
        exit 1
    fi
    echo ""
    
    # Upload all images
    upload_image "$FRONTEND_IMAGE" "$FRONTEND_REGISTRY_IMAGE" "Frontend"  
    upload_image "$NGINX_IMAGE" "$NGINX_REGISTRY_IMAGE" "Nginx"
    
    print_success "All images uploaded successfully!"
    echo ""
    print_step "Uploaded images:"
    echo "  - $FRONTEND_REGISTRY_IMAGE"
    echo "  - $NGINX_REGISTRY_IMAGE"
else
    print_step "Built images (local only):"
    echo "  - $FRONTEND_IMAGE"
    echo "  - $NGINX_IMAGE"
    echo ""
    print_warning "To upload to GCP Artifact Registry, run with --upload flag"
fi

print_success "Build process completed!"
