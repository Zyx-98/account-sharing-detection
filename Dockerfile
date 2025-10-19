# ----------- Base Stage: Install Dependencies -----------
FROM node:23-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci

# ----------- Development Stage: For Local Development -----------
FROM base AS development
WORKDIR /app

COPY . .
ENV NODE_ENV=development
EXPOSE 3000

CMD ["npm", "run", "start:dev"]

# ----------- Build Stage: Build the Application -----------
FROM base AS build
WORKDIR /app
COPY . .
ENV NODE_ENV=production

RUN npm run build

# ----------- Production Stage: Final Production Image -----------
FROM node:23-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/package.json ./

COPY --from=build /app/*lock*.yaml ./
COPY --from=build /app/*lock*.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

USER appuser

EXPOSE 3000

CMD ["node", "dist/main.js"]