# Secrets for the k8s manifests

The backend and Postgres manifests read the database password and the JWT
signing secret from a Secret named `mordi-secrets` rather than carrying them
in the YAML. Create it once per cluster, before applying anything else:

```bash
kubectl create secret generic mordi-secrets \
  --from-literal=db-password='<the Postgres password>' \
  --from-literal=jwt-secret="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")"
```

`db-password` is what both `POSTGRES_PASSWORD` and
`SPRING_DATASOURCE_PASSWORD` resolve to; `jwt-secret` becomes
`MORDI_JWT_SECRET`, and has to be 32+ bytes for HS256.

Nothing under `k8s/secrets/` is tracked (it is in `.gitignore`), so a
`kubectl get secret mordi-secrets -o yaml` dump can live there if it is ever
needed on disk.
