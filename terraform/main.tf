terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 5.0"
    }
  }
}

provider "google" {
  project                     = var.project_id
  region                      = var.region
  user_project_override       = true
  billing_project             = var.project_id
}

provider "google-beta" {
  project                     = var.project_id
  region                      = var.region
  user_project_override       = true
  billing_project             = var.project_id
}

# Enable required APIs
resource "google_project_service" "firebase" {
  service            = "firebase.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firestore" {
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "storage" {
  service            = "storage.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "identity_toolkit" {
  service            = "identitytoolkit.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "fcm" {
  service            = "fcm.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloud_resource_manager" {
  service            = "cloudresourcemanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firebasestorage" {
  service            = "firebasestorage.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "serviceusage" {
  service            = "serviceusage.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "eventarc" {
  service            = "eventarc.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service_identity" "eventarc" {
  provider = google-beta
  project  = var.project_id
  service  = google_project_service.eventarc.service

  depends_on = [google_project_service.eventarc]
}

# Enable Firebase for the project
resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id

  depends_on = [
    google_project_service.firebase
  ]
}

# Create Firebase Web App
resource "google_firebase_web_app" "wots_app" {
  provider     = google-beta
  project      = var.project_id
  display_name = "WOTS Student Progress App"

  depends_on = [google_firebase_project.default]
}

# Get the Firebase Web App config
data "google_firebase_web_app_config" "wots_app" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.wots_app.app_id

  depends_on = [google_firebase_web_app.wots_app]
}

# Create Firestore database
resource "google_firestore_database" "default" {
  provider                    = google-beta
  project                     = var.project_id
  name                        = "(default)"
  location_id                 = var.firestore_location
  type                        = "FIRESTORE_NATIVE"
  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"

  depends_on = [
    google_project_service.firestore,
    google_firebase_project.default
  ]
}

# Create the Cloud Storage bucket first
resource "google_storage_bucket" "default" {
  provider      = google-beta
  project       = var.project_id
  name          = "${var.project_id}-firebase-storage"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  depends_on = [
    google_project_service.storage,
    google_firebase_project.default
  ]
}

# Link the bucket to Firebase Storage
resource "google_firebase_storage_bucket" "default" {
  provider  = google-beta
  project   = var.project_id
  bucket_id = google_storage_bucket.default.name

  depends_on = [
    google_project_service.firebasestorage,
    google_storage_bucket.default
  ]
}

# Identity Platform config (for Google OAuth)
resource "google_identity_platform_config" "default" {
  provider = google-beta
  project  = var.project_id

  authorized_domains = [
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
  ]

  sign_in {
    allow_duplicate_emails = false

    anonymous {
      enabled = false
    }

    email {
      enabled           = false
      password_required = false
    }
  }

  depends_on = [
    google_project_service.identity_toolkit,
    google_firebase_project.default
  ]
}

# Enable Google as an identity provider
resource "google_identity_platform_default_supported_idp_config" "google" {
  provider = google-beta
  project  = var.project_id
  idp_id   = "google.com"

  client_id     = var.google_oauth_client_id
  client_secret = var.google_oauth_client_secret
  enabled       = true

  depends_on = [google_identity_platform_config.default]
}
