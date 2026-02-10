// Utility: Promisified exec
import { exec } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);
