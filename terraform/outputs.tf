output "firebase_config" {
  description = "Firebase configuration for the web app"
  value = {
    apiKey            = data.google_firebase_web_app_config.wots_app.api_key
    authDomain        = "${var.project_id}.firebaseapp.com"
    projectId         = var.project_id
    storageBucket     = "${var.project_id}.firebasestorage.app"
    messagingSenderId = data.google_firebase_web_app_config.wots_app.messaging_sender_id
    appId             = google_firebase_web_app.wots_app.app_id
  }
  sensitive = true
}

output "firebase_config_env" {
  description = "Firebase config as .env format (copy to .env file)"
  value       = <<-EOT
    VITE_FIREBASE_API_KEY=${data.google_firebase_web_app_config.wots_app.api_key}
    VITE_FIREBASE_AUTH_DOMAIN=${var.project_id}.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=${var.project_id}
    VITE_FIREBASE_STORAGE_BUCKET=${var.project_id}.firebasestorage.app
    VITE_FIREBASE_MESSAGING_SENDER_ID=${data.google_firebase_web_app_config.wots_app.messaging_sender_id}
    VITE_FIREBASE_APP_ID=${google_firebase_web_app.wots_app.app_id}
  EOT
  sensitive   = true
}

output "web_app_id" {
  description = "Firebase Web App ID"
  value       = google_firebase_web_app.wots_app.app_id
}

output "firestore_database" {
  description = "Firestore database name"
  value       = google_firestore_database.default.name
}
