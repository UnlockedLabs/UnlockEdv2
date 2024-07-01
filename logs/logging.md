### Logging

All default log directories for services like `nginx`, `postgres`, etc will have a volume mounted to the respective location
`/var/log/nginx/`

Logs will all be `json` whenever possible and will be aggregated in production
