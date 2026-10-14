FROM node:26-alpine AS build
WORKDIR /app
# The lockfile alone decides this layer, so packages are only installed again
# when a dependency actually changes. npm ci, not install: it installs exactly
# what the lockfile says and never rewrites it mid-build.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
# The Umami Cloud website id; public, and optional: with none, no analytics
# script is added.
ARG VITE_UMAMI_WEBSITE_ID
ENV VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Not in conf.d: everything there is loaded as a server block of its own.
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
