# LearningLinks production image.
#   docker build --target app   -t learninglinks .        # the web app
#   docker build --target tools -t learninglinks-tools .  # migrations, imports, preflight (has dev dependencies)
# Debian (glibc) rather than Alpine so sharp's prebuilt image library loads without compiling.

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# Nothing in the build needs a database or secrets: the app reads its settings when it starts.
RUN npm run build

# Scripts that must run against the real database before or beside the app.
FROM deps AS tools
COPY . .
ENV NODE_ENV=production
CMD ["npm", "run", "db:migrate"]

FROM base AS app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --gid 1001 app && useradd --uid 1001 --gid app --no-create-home --home-dir /app app \
 && mkdir -p /data/uploads && chown -R app:app /data
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
ENV UPLOAD_DIR=/data/uploads
VOLUME ["/data/uploads"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
