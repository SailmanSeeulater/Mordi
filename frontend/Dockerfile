FROM node:22-alpine AS build
WORKDIR /app
# The lockfile alone decides this layer, so packages are only installed again
# when a dependency actually changes. npm ci, not install: it installs exactly
# what the lockfile says and never rewrites it mid-build.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
