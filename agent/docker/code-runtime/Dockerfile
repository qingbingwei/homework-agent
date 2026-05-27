FROM python:3.11-bookworm

ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV MPLBACKEND=Agg

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential \
      cmake \
      gcc \
      g++ \
      git \
      graphviz \
      libglib2.0-0 \
      libgl1 \
      nodejs \
      npm \
      openjdk-17-jdk-headless \
      pkg-config \
      xvfb \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --upgrade pip \
    && python -m pip install \
      matplotlib \
      networkx \
      numpy \
      opencv-python-headless \
      pandas \
      pillow \
      scikit-learn \
      scipy \
      seaborn \
      sympy

WORKDIR /workspace
