FROM geographica/gdal2:2.3.2
ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update -y 
RUN apt-get install -y curl
RUN apt-get install -y imagemagick
RUN apt-get install -y poppler-utils

COPY policy.xml /etc/ImageMagick-6/policy.xml

COPY src/gdal2tiles_ll.py /usr/bin
RUN chmod +x /usr/bin/gdal2tiles_ll.py

#RUN apt-get install -y  apt-utils tzdata locales 
RUN apt-get install -y  convmv

RUN apt-get update -y 

RUN apt-get install -y  wget git-core vim fonts-powerline nodejs 
RUN ["apt-get", "install", "-y", "zsh"]

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

##nodejs is in version 8 :-/
## will install version 12

RUN apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash -

RUN apt -y install nodejs


RUN apt-get update -y 
RUN apt-get install -y yarn

ENV TERM xterm
ENV ZSH_THEME blinks

RUN wget https://github.com/robbyrussell/oh-my-zsh/raw/master/tools/install.sh -O - | zsh || true



RUN apt-get install -y  tzdata locales 

ENV LOCALE en_US
ENV ENCODING UTF-8

ENV LANG ${LOCALE}.${ENCODING}
ENV LANGUAGE ${LOCALE}.${ENCODING}
ENV LC_ALL ${LOCALE}.${ENCODING}
ENV TZ Europe/Berlin

RUN locale-gen $LC_ALL

RUN echo ${TZ} /etc/timezone
RUN dpkg-reconfigure locales
RUN dpkg-reconfigure tzdata

RUN echo "LC_ALL=${LOCALE}.${ENCODING}" >> /etc/environment
RUN echo "${LOCALE}.${ENCODING} ${ENCODING}" >> /etc/locale.gen
RUN echo "LANG=${LOCALE}.${ENCODING}" > /etc/locale.conf

WORKDIR /app
COPY ./package.json /app/
COPY .babelrc .
RUN yarn install
COPY ./src /app/src

RUN chsh -s /bin/zsh

COPY crontab /etc/cron/crontab

COPY entrypoint.sh /app/
CMD ["/app/entrypoint.sh"]


#COPY crontab /var/spool/cron/crontabs/root

#CMD ["sleep", "infinity"]

#ENTRYPOINT "cron"

#CMD ["-f"]
