# Homework Agent Code Runtime

Build the runtime image used by `CODE_EXECUTION_BACKEND=container`:

```bash
docker build -t homework-agent-code-runtime:latest -f agent/docker/code-runtime/Dockerfile agent/docker/code-runtime
```

Podman can use the same Dockerfile:

```bash
podman build -t homework-agent-code-runtime:latest -f agent/docker/code-runtime/Dockerfile agent/docker/code-runtime
```

The agent runs generated code with the workspace mounted at `/workspace`,
network disabled by default, and `MPLBACKEND=Agg` for headless plotting.
The image includes Python scientific packages, Node.js, OpenJDK 17, GCC/G++,
and common build utilities.
