# syntax = docker/dockerfile:1

ARG NODE_VERSION=20.17.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

WORKDIR /app
ENV NODE_ENV="production"


# Build stage: needs devDependencies (typescript) to compile TS -> dist/
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

COPY package-lock.json package.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build && npm prune --omit=dev


# Final image: compiled code, prod deps, and the SQL migrations the
# release_command applies at deploy time.
FROM base

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/automation/db/migrations ./automation/db/migrations

EXPOSE 3002
CMD [ "npm", "run", "start" ]
