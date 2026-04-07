# Simulator image using distro package (quick & simple)
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install ghdl and common utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghdl \
    gnat \
    gcc \
    make \
    wget \
    ca-certificates \
    tar \
    xz-utils \
    bzip2 \
    unzip \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Verify installation
RUN set -x && which ghdl && ghdl --version || (echo "ghdl not available" && exit 1)

CMD ["tail", "-f", "/dev/null"]
