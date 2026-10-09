const fs = require('fs');
const path = require('path');

const dir = './src/app/dashboard/admin/database';

function walk(currentDir) {
    let results = [];
    const list = fs.readdirSync(currentDir);
    list.forEach(file => {
        file = path.join(currentDir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(dir);
let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;

    // Define the type we'll use for the table data
    // Assuming we can extract the local interface name which is usually defined near the top.
    // e.g. "interface ModulLevel {" or "type ModulLevel = "
    const interfaceMatch = content.match(/(?:interface|type)\s+([A-Za-z0-9_]+)\s*(?:{|=)/);
    const typeName = interfaceMatch ? interfaceMatch[1] : 'Record<string, unknown>';

    // Fix queryClient.setQueriesData (old: any)
    content = content.replace(/\(old: any\)/g, `(old: { rows: ${typeName}[], total: number } | undefined)`);

    // Fix rows.map((row: any) => ...)
    content = content.replace(/\(row: any\)/g, `(row: ${typeName})`);

    // Fix levels.map((level: any) => ...) or items.map((item: any) => ...)
    content = content.replace(/\(([a-zA-Z]+): any\)/g, `($1: ${typeName})`);

    // Fix context: any
    content = content.replace(/context: any\)/g, `context: { previousData?: [readonly unknown[], unknown][] } | undefined)`);

    // Fix forEach(([qk, d]: any)
    content = content.replace(/forEach\(\(\[qk, d\]: any\)/g, `forEach(([qk, d]: [readonly unknown[], unknown])`);
    
    // Fallback any in context
    content = content.replace(/context\?\.previousData\?\.forEach/g, `context.previousData.forEach`);

    if (content !== originalContent) {
        fs.writeFileSync(file, content);
        console.log('Updated', file);
        changedCount++;
    }
});

console.log(`Changed ${changedCount} files.`);
