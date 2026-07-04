FROM alpine:3.19

# Install both git and the server daemon package
RUN apk add --no-cache git git-daemon && mkdir -p /git

EXPOSE 9418

# Use --reuseaddr to prevent TCP port-binding errors during fast restart cycles
CMD ["git", "daemon", "--verbose", "--export-all", "--base-path=/git", "--enable=receive-pack", "--reuseaddr", "/git"]
