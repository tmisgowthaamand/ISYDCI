const fs = require('fs');
const content = fs.readFileSync('scratch/bjp_flow_sample.json', 'utf8');
const types = [...content.matchAll(/"type":\s*"([A-Za-z]+)"/g)].map(m => m[1]);
console.log('Unique component types in sample:', [...new Set(types)]);
