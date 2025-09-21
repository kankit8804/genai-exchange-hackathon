FROM nginx:alpine
# copy static files
COPY public /usr/share/nginx/html
# SPA fallback: route unknown paths to index.html
RUN sed -i 's|try_files \$uri \$uri/ =404;|try_files \$uri \$uri/ /index.html;|' /etc/nginx/conf.d/default.conf
# Cloud Run expects port 8080
EXPOSE 8080
CMD ["sh", "-c", "sed -i 's/listen       80;/listen 8080;/' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
