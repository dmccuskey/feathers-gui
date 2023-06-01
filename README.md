# feathers-gui

A record editor for Feathersjs-wrapped databases. It can be run locally or used online.

Docs and online access at [https://FeathersGui.dev](https://feathersgui.dev)

## Project Overview

I've been using Feathersjs for several years and this is a tool I created to view and edit my data records during development.

This can be used either locally or online.

**Features**

- Support for multiple Servers and Services
- Real-time data updates
- Basic auth supported, ie. strategy `local`
- All configuration info is stored locally in `localStorage`
- Custom display for each data column
- Offers a template when adding new records to a Service

## Setup

### Local Use

_This is best if your Feathers server doesn't have a SSL connection and you aren't able to create SSL certificates._

Install steps:

1. Check out this repo
1. switch to the folder of the Featherjs version you want to run

| Fjs version | folder           |
| ----------- | ---------------- |
| v3          | &lt;soon&gt;     |
| v4          | `fgui-v4`        |
| v5          | &lt;soon-ish&gt; |

3. then run:

```bash
yarn install
yarn run serve
```

The server can be accessed at [http://localhost:9092](http://localhost:9092)

_The port number can be changed in `vue.config.js`._

Documentation at [FeathersGui.dev](https://feathersgui.dev)

### Online Use

The online docs and GUI versions are hosted at Netlify. They use secure HTTPS, so the Feathers server has to serve SSL as well.

Instructions on how to quickly create SSL certificates are at [FeathersGui.dev](https://feathersgui.dev).

## Coming up

1. New Component UI library and theme
1. Support for Featherjs v3
1. Import/Export Server/Service configs
