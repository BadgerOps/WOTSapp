# Custom Domain Setup for Firebase Hosting

This guide covers connecting a custom domain (e.g., `wotsapp.net`) to your Firebase-hosted application.

## Prerequisites

- A registered domain name (purchase from Google Domains, Namecheap, GoDaddy, Cloudflare, etc.)
- Access to your domain's DNS settings
- Firebase project with Hosting enabled

## Steps

### 1. Open Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`wots-app-484617`)
3. Navigate to **Hosting** in the left sidebar

### 2. Add Custom Domain

1. Click **Add custom domain**
2. Enter your domain: `wotsapp.net`
3. Click **Continue**

### 3. Verify Domain Ownership

Firebase will provide a TXT record to verify you own the domain.

1. Copy the TXT record value provided by Firebase
2. Go to your domain registrar's DNS management panel
3. Add a new TXT record:
   - **Host/Name:** `@` (or leave blank, depending on registrar)
   - **Type:** `TXT`
   - **Value:** The verification string from Firebase
   - **TTL:** 3600 (or default)
4. Click **Verify** in Firebase Console

> **Note:** DNS propagation can take anywhere from a few minutes to 48 hours. Most registrars propagate within 10-30 minutes.

### 4. Add DNS A Records

After verification, Firebase will provide two A record IP addresses. Add both:

| Host/Name | Type | Value |
|-----------|------|-------|
| `@` | A | `151.101.1.195` |
| `@` | A | `151.101.65.195` |

> **Note:** The actual IP addresses will be shown in Firebase Console. The IPs above are examples.

### 5. (Optional) Add www Subdomain

If you want `www.wotsapp.net` to also work:

1. In Firebase Console, click **Add custom domain** again
2. Enter `www.wotsapp.net`
3. Choose to redirect to `wotsapp.net` (recommended) or serve the same content
4. Add the required DNS records (typically a CNAME):
   - **Host/Name:** `www`
   - **Type:** `CNAME`
   - **Value:** `wotsapp.net` (or the Firebase-provided value)

### 6. Wait for SSL Certificate

Firebase automatically provisions a free SSL certificate via Let's Encrypt.

- This usually completes within 24 hours after DNS records propagate
- During provisioning, you may see a security warning when visiting your domain
- Check status in Firebase Console under **Hosting > Custom domains**

Status progression:
1. **Needs setup** - DNS records not yet detected
2. **Pending** - DNS verified, waiting for SSL certificate
3. **Connected** - Fully configured and live

## DNS Configuration Examples

### Cloudflare

```
Type    Name    Content              TTL    Proxy
TXT     @       firebase-verify=...  Auto   DNS only
A       @       151.101.1.195        Auto   DNS only
A       @       151.101.65.195       Auto   DNS only
CNAME   www     wotsapp.net          Auto   DNS only
```

> **Important:** If using Cloudflare, set proxy status to **DNS only** (gray cloud) for the A records. Orange cloud (proxied) can interfere with Firebase's SSL provisioning.

### Google Domains / Squarespace Domains

```
Host name    Type    TTL     Data
@            TXT     1H      firebase-verify=...
@            A       1H      151.101.1.195
@            A       1H      151.101.65.195
www          CNAME   1H      wotsapp.net
```

### Namecheap

```
Type     Host    Value                 TTL
TXT      @       firebase-verify=...   Automatic
A        @       151.101.1.195         Automatic
A        @       151.101.65.195        Automatic
CNAME    www     wotsapp.net           Automatic
```

## Troubleshooting

### Domain stuck on "Needs setup"

- Verify DNS records are correct using [DNS Checker](https://dnschecker.org)
- Ensure no conflicting records exist (remove old A/AAAA records)
- Wait up to 48 hours for full DNS propagation

### SSL certificate not provisioning

- Ensure A records point to Firebase's IPs exactly
- If using Cloudflare, disable proxy (use DNS only mode)
- Check for CAA records that might block Let's Encrypt

### "This site can't be reached" error

- DNS propagation may still be in progress
- Clear browser cache and try incognito mode
- Verify A records are correctly configured

## After Setup

Once connected, your app will be accessible at:
- `https://wotsapp.net`
- `https://www.wotsapp.net` (if configured)
- `https://wots-app-484617.web.app` (still works as backup)

All HTTP traffic is automatically redirected to HTTPS.

## Updating Terraform (Optional)

If managing infrastructure via Terraform, you can add the custom domain configuration:

```hcl
resource "google_firebase_hosting_site" "default" {
  provider = google-beta
  project  = var.project_id
  site_id  = var.project_id
}

resource "google_firebase_hosting_custom_domain" "default" {
  provider      = google-beta
  project       = var.project_id
  site_id       = google_firebase_hosting_site.default.site_id
  custom_domain = "wotsapp.net"
}
```

> **Note:** Terraform support for Firebase Hosting custom domains may require the `google-beta` provider.

## References

- [Firebase Hosting Custom Domain Docs](https://firebase.google.com/docs/hosting/custom-domain)
- [Firebase Hosting Pricing](https://firebase.google.com/pricing) (custom domains are free)
