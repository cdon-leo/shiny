import { BigQuery } from "@google-cloud/bigquery";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { NextRequest, NextResponse } from "next/server";

/**
 * Gets a BigQuery client with appropriate authentication.
 * If SECRET_NAME and GOOGLE_CLOUD_PROJECT are set, uses Secret Manager.
 * Otherwise, falls back to Application Default Credentials.
 */
async function getBigQueryClient(): Promise<BigQuery> {
  const secretName = process.env.SECRET_NAME;
  console.log("secretName", secretName);
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const bigqueryProject = process.env.BIGQUERY_PROJECT;

  if (secretName) {
    // Production mode: Use Secret Manager
    console.log("Using Secret Manager authentication for BigQuery");
    console.log("secretName", secretName);

    if (!projectId) {
      throw new Error(
        "GOOGLE_CLOUD_PROJECT environment variable is required when using SECRET_NAME"
      );
    }

    try {
      // Create the Secret Manager client
      // In Cloud Run, this will automatically use the service account attached to the service
      const secretClient = new SecretManagerServiceClient();

      // Build the resource name of the secret version
      const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

      // Access the secret version
      const [version] = await secretClient.accessSecretVersion({ name });

      // Decode the secret payload (the JSON key)
      const payload = version.payload?.data;
      if (!payload) {
        throw new Error("Secret payload is empty");
      }

      const keyJsonStr =
        typeof payload === "string"
          ? payload
          : Buffer.from(payload as Uint8Array).toString("utf-8");
      const keyData = JSON.parse(keyJsonStr);

      // Use the project from the service account for data access
      const dataProjectId = keyData.project_id || bigqueryProject;

      // Create the BigQuery client with service account credentials
      return new BigQuery({
        projectId: dataProjectId,
        credentials: keyData,
      });
    } catch (error) {
      throw new Error(
        `Failed to access secret '${secretName}' in project '${projectId}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    // Local development mode: Use Application Default Credentials
    console.log("Using Application Default Credentials for BigQuery");
    console.log("Make sure you've run: gcloud auth application-default login");

    // Use BIGQUERY_PROJECT if provided, otherwise let the client use the default project
    const options = bigqueryProject ? { projectId: bigqueryProject } : {};

    if (!bigqueryProject) {
      console.log(
        "No BIGQUERY_PROJECT specified. Will use the default project from gcloud config."
      );
    }

    return new BigQuery(options);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, location, parameters, parameterTypes } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    // Get BigQuery client with appropriate authentication
    const bigquery = await getBigQueryClient();

    // Execute the query
    const [rows] = await bigquery.query({
      query: query,
      location: location || "europe-north1", // Default to EU if not specified
    });

    // Return the results
    return NextResponse.json({
      success: true,
      rows: rows,
      rowCount: rows.length,
    });
  } catch (error) {
    console.error("BigQuery error:", error);

    // Return error details
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
        success: false,
      },
      { status: 500 }
    );
  }
}
