/**
 * SceneCompiler - Compiles scene source code strings into usable scene classes at runtime.
 * Used by the AI assistant to apply code modifications without touching source files.
 */

export function compileScene(sourceCode) {
    try {
        // Strip export keywords - they're invalid in Function() context
        const cleanedSource = sourceCode
            .replace(/export\s+default\s+/g, '')
            .replace(/export\s+/g, '');

        // Find the scene class name
        const classNameMatch = cleanedSource.match(/class\s+(\w+Scene)\s/);
        if (!classNameMatch) {
            return { error: 'No scene class found in source code (class name must end with "Scene")', sceneClass: null };
        }
        const className = classNameMatch[1];

        // Wrap and evaluate
        const wrappedCode = `${cleanedSource}\nreturn ${className};`;
        const SceneClass = new Function(wrappedCode)();

        // Validate required interface
        const proto = SceneClass.prototype;
        const missing = [];
        if (typeof proto.update !== 'function') missing.push('update');
        if (typeof proto.render !== 'function') missing.push('render');
        if (missing.length > 0) {
            return { error: `Scene class missing required methods: ${missing.join(', ')}`, sceneClass: null };
        }

        return { error: null, sceneClass: SceneClass };
    } catch (e) {
        return { error: `Compilation error: ${e.message}`, sceneClass: null };
    }
}
