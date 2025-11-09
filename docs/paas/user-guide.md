# PaaS User Guide

## Welcome to SkyPanelV2 PaaS

Deploy your applications with ease using our Heroku-like Platform-as-a-Service!

---

## Quick Start

### 1. Create Your First Application

1. Navigate to **PaaS** > **Applications** in the dashboard
2. Click **"New Application"**
3. Fill in:
   - **Name**: My Awesome App
   - **Slug**: my-awesome-app (unique identifier)
   - **Git Repository**: https://github.com/yourusername/your-app
   - **Branch**: main
   - **Plan**: Choose a resource plan (Hobby, Standard, Pro, Business)
4. Click **"Create Application"**

Your app is created! Now let's deploy it.

###2. Deploy Your Application

1. Click on your application in the list
2. Click **"Deploy"**
3. Watch the real-time build logs
4. Once deployed, access your app at: `my-awesome-app-xxxxx.apps.yourdomain.com`

---

## Supported Frameworks

Our PaaS automatically detects and builds:

- **Node.js** (package.json)
- **Python** (requirements.txt, Pipfile)
- **Ruby** (Gemfile)
- **PHP** (composer.json, index.php)
- **Go** (go.mod)
- **Java** (pom.xml, build.gradle)

### Example: Deploying a Node.js App

**Your repository should contain:**
```
package.json  # Required
Procfile      # Optional (defaults to npm start)
```

**Example Procfile:**
```
web: node server.js
```

---

## Environment Variables

### Adding Environment Variables

1. Open your application
2. Go to **"Environment"** tab
3. Click **"Add Variable"**
4. Enter:
   - Key: `DATABASE_URL`
   - Value: `postgresql://user:pass@host:5432/db`
5. Click **"Save"**

### System Environment Variables

Automatically provided to your app:
- `PORT` - Port your app should listen on (typically 5000)
- `DYNO` - Dyno identifier (web.1)
- `PS` - Process type (web)

### Best Practices

- Never commit secrets to git
- Use environment variables for all configuration
- Redeploy after adding critical env vars

---

## Scaling

### Horizontal Scaling (Replicas)

Increase replicas to handle more traffic:

1. Open your application
2. Go to **"Settings"** tab
3. Adjust **"Replicas"** slider (1-20 depending on plan)
4. Click **"Scale"**

Your app will run across multiple containers with automatic load balancing!

### Vertical Scaling (Resources)

Upgrade your plan for more CPU/RAM:

1. Open your application
2. Go to **"Settings"** > **"Plan"**
3. Choose a higher tier (Pro, Business)
4. Confirm upgrade

---

## Deployment History

### View Previous Deployments

1. Open your application
2. Go to **"Deployments"** tab
3. See all deployments with:
   - Version number
   - Git commit
   - Build status
   - Deployment timestamp

### Rollback to a Previous Version

1. Find the deployment you want to rollback to
2. Click **"Rollback"**
3. Confirm the action

Your app will revert to that version instantly!

---

## Viewing Logs

### Real-Time Logs

1. Open your application
2. Go to **"Logs"** tab
3. Logs stream in real-time

### Search Logs

- Use the search box to filter logs
- Filter by level: info, warning, error
- Set time range: Last hour, 24 hours, 7 days

### Log Retention

Logs are kept for **7 days** by default.

---

## Custom Domains

### Add a Custom Domain

1. Open your application
2. Go to **"Domains"** tab
3. Click **"Add Domain"**
4. Enter your domain: `www.myapp.com`
5. Follow DNS configuration instructions:
   ```
   Type: CNAME
   Name: www
   Value: my-awesome-app-xxxxx.apps.yourdomain.com
   ```
6. Wait for DNS propagation (up to 24 hours)
7. SSL certificate will be automatically provisioned via Let's Encrypt

---

## Plans & Pricing

### Available Plans

| Plan | CPU | RAM | Replicas | Price/Hour |
|------|-----|-----|----------|------------|
| **Hobby** | 0.5 cores | 512MB | 1 | $0.0069 (~$5/mo) |
| **Standard** | 1 core | 1GB | 3 | $0.0347 (~$25/mo) |
| **Pro** | 2 cores | 2GB | 10 | $0.0694 (~$50/mo) |
| **Business** | 4 cores | 4GB | 20 | $0.1389 (~$100/mo) |

### Billing

- Billed hourly from your wallet
- Auto-stop when balance reaches $0
- Top up wallet in **Billing** > **Add Funds**

---

## Troubleshooting

### Build Failed

**Check build logs:**
1. Go to **Deployments** tab
2. Click on failed deployment
3. Review error messages

**Common Issues:**
- Missing dependencies in `package.json`/`requirements.txt`
- Node/Python version mismatch (specify in app)
- Build timeout (large dependencies)

**Solutions:**
- Add `.node-version` file for Node.js
- Add `runtime.txt` for Python
- Optimize dependencies

### App Won't Start

**Check app logs:**
- Look for crash errors
- Ensure your app listens on `process.env.PORT`

**Example (Node.js):**
```javascript
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### App is Slow

**Solutions:**
1. **Upgrade plan** - More CPU/RAM
2. **Scale horizontally** - Add more replicas
3. **Optimize code** - Profile and fix bottlenecks
4. **Add caching** - Redis, CDN

### 503 Service Unavailable

**Causes:**
- App crashed (check logs)
- Health check failing
- Deployment in progress

**Solutions:**
- Fix crash errors in code
- Ensure `/health` endpoint exists (if configured)
- Wait for deployment to complete

---

## Best Practices

### 1. Use a Procfile

Define how your app starts:
```
web: npm run start:prod
worker: npm run worker
```

### 2. Enable Health Checks

Add a health endpoint:
```javascript
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});
```

### 3. Log to STDOUT

Use console.log, not files:
```javascript
console.log('User logged in:', userId);
console.error('Error occurred:', error);
```

### 4. Handle Graceful Shutdown

```javascript
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server shut down gracefully');
    process.exit(0);
  });
});
```

### 5. Use Environment Variables

Never hardcode:
```javascript
const DB_URL = process.env.DATABASE_URL;
const API_KEY = process.env.API_KEY;
```

---

## Example Applications

### Node.js Express App

**package.json:**
```json
{
  "name": "my-app",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

**server.js:**
```javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Hello from PaaS!');
});

app.listen(PORT, () => {
  console.log(`App running on port ${PORT}`);
});
```

**Procfile:**
```
web: node server.js
```

### Python Flask App

**requirements.txt:**
```
Flask==2.3.0
gunicorn==20.1.0
```

**app.py:**
```python
from flask import Flask
import os

app = Flask(__name__)

@app.route('/')
def hello():
    return 'Hello from PaaS!'

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
```

**Procfile:**
```
web: gunicorn app:app
```

---

## FAQ

**Q: How long does a build take?**
A: 2-10 minutes depending on dependencies.

**Q: Can I use databases?**
A: Yes! Use external databases (PostgreSQL, MySQL, MongoDB as a service) or provision via add-ons (coming soon).

**Q: How many apps can I create?**
A: Depends on your organization limits (default: 10).

**Q: Can I deploy private repositories?**
A: Yes! Use SSH git URLs with deploy keys.

**Q: What happens if I run out of funds?**
A: Your apps will be stopped. Add funds to resume.

---

## Support

Need help? Contact support:
- **Support Tickets**: Dashboard > Support
- **Documentation**: `/docs/paas`
- **Status**: Check service health at `/admin#paas-overview` (admins only)

---

**Happy Deploying! 🚀**
