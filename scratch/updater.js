const fs = require('fs');
const path = require('path');

const updateFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. py-20 to py-24 for vertical rhythm
    content = content.replace(/py-20/g, 'py-24');

    // 2. Add tracking-tight to headlines if not present
    content = content.replace(/<(h[1-4])([^>]*)class="([^"]*)"/g, (match, tag, beforeClass, classList) => {
        if (!classList.includes('tracking-tight')) {
            return `<${tag}${beforeClass}class="${classList} tracking-tight"`;
        }
        return match;
    });

    // 3. Update <p> tags for better legibility if they don't have text-base or leading-relaxed
    content = content.replace(/<p([^>]*)class="([^"]*)"/g, (match, beforeClass, classList) => {
        let newClassList = classList;
        if (!newClassList.includes('leading-relaxed')) {
            newClassList += ' leading-relaxed';
        }
        if (!newClassList.includes('text-lg') && !newClassList.includes('text-base')) {
            newClassList += ' text-base md:text-lg';
        }
        if (newClassList !== classList) {
            return `<p${beforeClass}class="${newClassList}"`;
        }
        return match;
    });

    // 4. Update Hover states on .btn-gradient
    content = content.replace(/class="([^"]*btn-gradient[^"]*)"/g, (match, classList) => {
        let newClassList = classList;
        if (!newClassList.includes('hover:-translate-y-1')) {
            newClassList += ' hover:-translate-y-1';
        }
        if (!newClassList.includes('hover:shadow-xl')) {
            newClassList += ' hover:shadow-xl hover:shadow-primary/30';
        }
        if (!newClassList.includes('transition-all')) {
            newClassList += ' transition-all duration-300';
        }
        return `class="${newClassList}"`;
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
};

updateFile(path.join(__dirname, '../index.html'));
updateFile(path.join(__dirname, '../soca.html'));
