FROM python:3.11.9-slim-bullseye

RUN apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
  python3-venv \
  python3-dev \
  libpq-dev \
  psmisc \
  python3 \
  python3-pip \
  python3-sphinx \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /kolibri
RUN python3 -m venv .
ENV PATH="/kolibri/bin:$PATH"
RUN ./bin/pip3 install --upgrade pip setuptools \
  && ./bin/pip3 install psycopg2-binary==2.9.9 kolibri kolibri-oidc-client-plugin
ENV KOLIBRI_HOME=/kolibrihome
ENV KOLIBRI_RUN_MODE=production
ENV KOLIBRI_HTTP_PORT=8000
ENV KOLIBRI_DATABASE_ENGINE=postgres
ENV KOLIBRI_DATABASE_NAME=kolibri
ENV KOLIBRI_DATABASE_USER=kolibri
ENV KOLIBRI_DATABASE_PASSWORD=dev
ENV KOLIBRI_DATABASE_HOST=postgres
RUN kolibri plugin enable kolibri_oidc_client_plugin
EXPOSE 8000
CMD ["kolibri", "start", "--foreground", "--debug"]
