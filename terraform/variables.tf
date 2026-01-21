variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The default GCP region"
  type        = string
  default     = "us-central1"
}

variable "firestore_location" {
  description = "Firestore database location (cannot be changed after creation)"
  type        = string
  default     = "nam5" # Multi-region US
}

variable "google_oauth_client_id" {
  description = "Google OAuth 2.0 Client ID (from GCP Console > APIs & Services > Credentials)"
  type        = string
}

variable "google_oauth_client_secret" {
  description = "Google OAuth 2.0 Client Secret"
  type        = string
  sensitive   = true
}
