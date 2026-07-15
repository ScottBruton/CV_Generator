'use strict';

const fs = require('fs');
const path = require('path');
const { writeMarkerFiles } = require('./company-markers');

const ROOT = path.resolve(__dirname, '..');
const configPath = path.join(ROOT, 'content', 'companies', 'company-markers.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

writeMarkerFiles(config, ROOT);
console.log('Generated company marker SVGs in assets/logos/companies/company_logos/');
