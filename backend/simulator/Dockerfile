# Simulator image using prebuilt GHDL from conda-forge (fast, reliable)
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies needed for conda and running GHDL
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    bzip2 \
    ca-certificates \
    build-essential \
    git \
    libreadline-dev \
    libffi-dev \
    libgmp-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Miniconda
ENV CONDA_DIR=/opt/conda
RUN wget --quiet https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh \
    && bash /tmp/miniconda.sh -b -p ${CONDA_DIR} \
    && rm /tmp/miniconda.sh
ENV PATH="${CONDA_DIR}/bin:${PATH}"

# Configure conda and install ghdl from conda-forge
RUN conda config --set always_yes yes --set changeps1 no \
    && conda update -n base -c defaults conda \
    && conda install -c conda-forge ghdl \
    && conda clean -afy

# Verify installation
RUN set -x && which ghdl && ghdl --version || (echo "ghdl not available" && exit 1)

# Keep container idle; server will run commands by creating containers from this image
CMD ["tail", "-f", "/dev/null"]
