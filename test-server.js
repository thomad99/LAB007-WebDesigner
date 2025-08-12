import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testServer() {
  try {
    console.log('Testing server syntax...');
    
    // Try to start the server
    const { stdout, stderr } = await execAsync('node -c src/server/index.js');
    
    if (stderr) {
      console.log('Syntax check failed:');
      console.log(stderr);
    } else {
      console.log('Syntax check passed! Server file is valid.');
    }
    
  } catch (error) {
    console.log('Error checking syntax:', error.message);
  }
}

testServer();
