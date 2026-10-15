// Evaluates three.js in its own task (QA M1): the island imports this, yields, then imports the scene,
// so module evaluation and scene construction never land in one long task. Same chunk as the scene's.
export { REVISION } from 'three'
