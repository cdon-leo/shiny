FROM nginx:alpine

# Install envsubst (part of gettext package)
RUN apk add --no-cache gettext

# Remove default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx configuration template
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template

# Set default environment variables (can be overridden)
ENV FRONTEND_URL=http://frontend:3000

# Expose port 80
EXPOSE 80

# Start nginx
# The official nginx image automatically processes templates in /etc/nginx/templates/
# and substitutes environment variables when the container starts
CMD ["nginx", "-g", "daemon off;"]
