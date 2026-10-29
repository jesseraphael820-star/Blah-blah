# For hosts that run containers: Railway, Fly.io, Koyeb, Render (worker), etc.
FROM node:20-alpine

WORKDIR /app

# Install only production deps first (better layer caching).
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# DISCORD_TOKEN (and optional GUILD_ID) must be set as environment
# variables in the host's dashboard — never bake them into the image.
CMD ["node", "src/index.js"]
