# prepare (only invalidate cache on dependency change)
FROM alpine:3.13 AS prep
RUN apk update && apk add --no-cache jq
COPY package.json /tmp
RUN jq '{ dependencies, devDependencies, scripts }' < /tmp/package.json > /tmp/prepared.json

# build
FROM node:16.5.0-alpine3.13 AS builder
WORKDIR /app
COPY tsconfig.json ./
COPY --from=prep /tmp/prepared.json ./package.json
COPY package-lock.json ./
RUN npm ci
COPY src ./src
RUN npm run build && npm prune --production

# start
FROM node:16.5.0-alpine3.13 AS runner
WORKDIR /app
RUN apk update && apk add --no-cache bash
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node
CMD ["node", "dist/main"]
