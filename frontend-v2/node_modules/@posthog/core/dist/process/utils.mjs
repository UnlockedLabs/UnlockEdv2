import node_path from "node:path";
import node_fs from "node:fs";
const getLocalPaths = (startPath)=>{
    const paths = [];
    let currentPath = startPath;
    while(true){
        paths.push(currentPath);
        const parentPath = node_path.resolve(currentPath, '..');
        if (parentPath === currentPath) break;
        currentPath = parentPath;
    }
    return paths;
};
const buildLocalBinaryPaths = (cwd)=>{
    const possibleLocations = [
        'node_modules/.bin',
        'node_modules/.pnpm/node_modules/.bin'
    ];
    const localPaths = getLocalPaths(node_path.resolve(cwd)).flatMap((localPath)=>possibleLocations.map((location)=>node_path.join(localPath, location)));
    return localPaths;
};
function resolveBinaryPath(binName, options) {
    const envLocations = options.path.split(node_path.delimiter);
    const localLocations = buildLocalBinaryPaths(options.cwd);
    const directories = [
        ...new Set([
            ...localLocations,
            ...envLocations
        ])
    ];
    for (const directory of directories){
        const binaryPath = node_path.join(directory, binName);
        if (node_fs.existsSync(binaryPath)) return binaryPath;
    }
    throw new Error(`Binary ${binName} not found`);
}
export { buildLocalBinaryPaths, resolveBinaryPath };
