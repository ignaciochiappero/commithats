import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { withToolPath } from '../src/core/tool-path.js';

describe('withToolPath', () => {
  it('adds the Homebrew folders in front of the system ones an app gets from the Finder', () => {
    const env = withToolPath({ PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: '/Users/ada' }, 'darwin');
    assert.deepEqual(env, { PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin', HOME: '/Users/ada' });
  });

  it('keeps a PATH that already has them, in its own order', () => {
    const env = { PATH: '/Users/ada/bin:/usr/local/bin:/usr/bin:/opt/homebrew/bin' };
    assert.equal(withToolPath(env, 'darwin'), env);
  });

  it('only adds the folders that are missing', () => {
    assert.equal(withToolPath({ PATH: '/usr/local/bin:/usr/bin' }, 'darwin').PATH, '/opt/homebrew/bin:/usr/local/bin:/usr/bin');
  });

  it('works without any PATH', () => {
    assert.equal(withToolPath({}, 'darwin').PATH, '/opt/homebrew/bin:/usr/local/bin');
  });

  it('leaves other systems alone', () => {
    const env = { PATH: '/usr/bin:/bin' };
    assert.equal(withToolPath(env, 'linux'), env);
    assert.equal(withToolPath(env, 'win32'), env);
  });
});
