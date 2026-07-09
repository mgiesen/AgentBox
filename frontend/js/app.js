// Entry-Point: lädt alle Module, initialisiert sie der Reihe nach,
// löst initialen Refresh aus und startet den Live-Sync. Reihenfolge ist
// wichtig: selection vor files (files liest selection-State im Render),
// menu vor sidebar (sidebar.toggle ruft menu.closeMenu beim Schließen).

import * as sidebar from './sidebar.js';
import * as docs from './docs.js';
import * as config from './config.js';
import * as selection from './selection.js';
import * as files from './files.js';
import * as upload from './upload.js';
import * as menu from './menu.js';
import * as sse from './sse.js';
import * as smb from './smb.js';
import * as logout from './logout.js';
import * as titleMenu from './title-menu.js';
import * as tools from './tools.js';

selection.init();
files.init();
menu.init();
upload.init();
sidebar.init();
docs.init();
config.init();
smb.init();
logout.init();
titleMenu.init();
tools.init();

files.refresh();
sse.start();
