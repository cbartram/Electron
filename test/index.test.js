/* eslint-disable no-new */
const { expect } = require('chai');
const { describe, it } = require('mocha');
const Electron = require('../src');

describe('Electron constructor Tests', () => {
  it('Throws an error when stages passed into the constructor are not an array', (done) => {
    try {
      new Electron('Foo');
    } catch (err) {
      expect(err.message).to.be.a('string').that.equals('Param stages must be an Array');
      done();
    }
  });

  it('Successfully instantiates stages from the constructor', (done) => {
    const e = new Electron([{}, {}, {}]);
    expect(e.stages).to.be.a('array');
    expect(e.stages.length).to.be.a('number').that.equals(3);
    done();
  });
});

describe('Add Stage Tests', () => {
  it('Throws an error when the stage name is omitted', (done) => {
    try {
      new Electron().addStage();
    } catch (err) {
      expect(err.message).to.be.a('string').that.equals('Your stage must have a unique name');
      done();
    }
  });

  it('Throws an error when the up() function is omitted', (done) => {
    try {
      new Electron().addStage('Foo', { down: () => {} });
    } catch (err) {
      expect(err.message).to.be.a('string').that.equals('Your stage implementation must have an up() and down() methods');
      done();
    }
  });

  it('Throws an error when the down() function is omitted', (done) => {
    try {
      new Electron().addStage('Foo', { up: () => {} });
    } catch (err) {
      expect(err.message).to.be.a('string').that.equals('Your stage implementation must have an up() and down() methods');
      done();
    }
  });

  it('Throws an error for duplicate stage names', (done) => {
    try {
      const tx = new Electron();
      tx.addStage('Foo', { up: () => {}, down: () => {} });
      tx.addStage('Foo', { up: () => {}, down: () => {} }); // Error is thrown here
    } catch (err) {
      expect(err.message).to.be.a('string').that.equals('That stage name is already used in a previous stage please choose another.');
      done();
    }
  });

  it('Successfully adds a stage', (done) => {
    const tx = new Electron();
    tx.addStage('Foo', { up: () => {}, down: () => {} });
    expect(tx.getStage('Foo').name).to.be.a('string').that.equals('Foo');
    done();
  });

  it('When a before hook is omitted it resolves a promise with "true"', (done) => {
    const tx = new Electron();
    tx.addStage('Foo', { up: () => {}, down: () => {} });

    const stage = tx.getStage('Foo');
    stage.before().then(bool => expect(bool).to.be.a('boolean').that.equals(true));
    done();
  });

  it('When a before hook is specified the promise resolve with the data', (done) => {
    const tx = new Electron();
    tx.addStage('Foo', {
      up: () => {},
      down: () => {},
      before: () => 'it works!',
    });

    const stage = tx.getStage('Foo');
    stage.before().then(bool => expect(bool).to.be.a('string').that.equals('it works!'));
    done();
  });

  it('When an after hook is omitted it resolves to a promise with "true"', (done) => {
    const tx = new Electron();
    tx.addStage('Foo', { up: () => {}, down: () => {} });

    const stage = tx.getStage('Foo');
    stage.after().then(bool => expect(bool).to.be.a('boolean').that.equals(true));
    done();
  });

  it('When a after hook is specified the promise resolve with the data', (done) => {
    const tx = new Electron();
    tx.addStage('Foo', {
      up: () => {},
      down: () => {},
      after: () => 'it works!',
    });

    const stage = tx.getStage('Foo');
    stage.after().then(bool => expect(bool).to.be.a('string').that.equals('it works!'));
    done();
  });
});

describe('Remove stage tests', () => {
  it('Throws an error when no stage name is specified', (done) => {
    try {
      const tx = new Electron();
      tx.addStage('Foo', { up: () => {}, down: () => {} });
      tx.removeStage();
    } catch (err) {
      expect(err.message).to.be.a('string').that.equals('Cannot remove stage name of undefined');
      done();
    }
  });

  it('Successfully removes a stage given the proper stage name', (done) => {
    const tx = new Electron();
    tx.addStage('Foo', { up: () => {}, down: () => {} });
    tx.removeStage('Foo');
    expect(tx.stages.length).to.be.a('number').that.equals(0);
    done();
  });
});

describe('Get stage tests', () => {
  it('Throws an error when no stage name is specified', (done) => {
    try {
      const tx = new Electron();
      tx.addStage('Foo', { up: () => {}, down: () => {} });
      tx.getStage();
    } catch (err) {
      expect(err.message).to.be.a('string').that.equals('Cannot find stage name of undefined');
      done();
    }
  });

  it('Successfully finds a stage given the proper stage name', (done) => {
    const tx = new Electron();
    tx.addStage('Foo', { up: () => {}, down: () => {} });
    const stage = tx.getStage('Foo');
    expect(stage.name).to.be.a('string').that.equals('Foo');
    done();
  });
});

describe('Stage execution and rollback', () => {
  /**
   * A mocked async promise used in unit tests
   * @param url
   * @returns {Promise<any>}
   */
  const mockRequest = (url) => {
    const users = {
      4: {
        name: 'Mark',
      },
      5: {
        name: 'Paul',
      },
    };

    return new Promise((resolve, reject) => {
      const userId = parseInt(url.substr('/users/'.length), 10);
      process.nextTick(() => (users[userId] ? resolve(users[userId]) : reject(new Error('User with the id could not be found'))));
    });
  };

  it('Successfully executes a single async stage', () => {
    const tx = new Electron();
    tx.addStage('get-user', {
      up: () => mockRequest('/users/4'),
      down: () => true,
    });

    tx.execute().then((data) => {
      expect(data['get-user']).to.be.a('object').that.deep.equals({ name: 'Mark' });
    });
  });

  it('Successfully executes multiple async stages', () => {
    const tx = new Electron();
    tx.addStage('get-user', {
      up: () => mockRequest('/users/4'),
      down: () => true,
    });

    tx.addStage('get-another-user', {
      up: () => mockRequest('/users/5'),
      down: () => true,
    });

    tx.execute().then((data) => {
      expect(data['get-user']).to.be.a('object').that.deep.equals({ name: 'Mark' });
      expect(data['get-another-user']).to.be.a('object').that.deep.equals({ name: 'Paul' });
    });
  });

  it('Successfully executes the before hook', () => {
    const tx = new Electron();
    tx.addStage('get-user', {
      up: () => mockRequest('/users/4'),
      down: () => true,
    });

    tx.addStage('get-another-user', {
      before: (data) => {
        // We expect data to contain the result from the get-user stage
        expect(data['get-user']).to.be.a('object').that.deep.equals({ name: 'Mark' });
      },
      up: () => mockRequest('/users/5'),
      down: () => true,
    });

    tx.execute().then((data) => {
      expect(data['get-user']).to.be.a('object').that.deep.equals({ name: 'Mark' });
      expect(data['get-another-user']).to.be.a('object').that.deep.equals({ name: 'Paul' });
    });
  });

  it('Successfully executes the after hook', () => {
    const tx = new Electron();
    tx.addStage('get-user', {
      up: () => mockRequest('/users/4'),
      down: () => true,
    });

    tx.addStage('get-another-user', {
      after: (data) => {
        // We expect data to contain the result from this stage "get-another-user"
        expect(data).to.be.a('object').that.deep.equals({ name: 'Paul' });
      },
      up: () => mockRequest('/users/5'),
      down: () => true,
    });

    tx.execute().then((data) => {
      expect(data['get-user']).to.be.a('object').that.deep.equals({ name: 'Mark' });
      expect(data['get-another-user']).to.be.a('object').that.deep.equals({ name: 'Paul' });
    });
  });

  it('Successfully rolls back all stages when one fails', () => {
    const tx = new Electron();
    tx.addStage('get-user', {
      up: () => mockRequest('/users/4'),
      down: () => 'Rollback for get-user',
    });

    tx.addStage('get-another-user', {
      up: () => mockRequest('/users/5'),
      down: () => 'Rollback for get-another-user',
    });

    // This stage will fail
    tx.addStage('get-invalid-user', {
      up: () => mockRequest('/users/1'), // Their is no /users/1
      down: () => 'Oh no!',
    });

    tx.execute().then(data => expect(data).to.be.an('array').that.deep.equals(['Rollback for get-another-user', 'Rollback for get-user']));
  });

  it('Throws an error when one of the rollbacks fails', () => {
    const tx = new Electron();
    tx.addStage('get-user', {
      up: () => mockRequest('/users/4'),
      down: () => {
        throw new Error('Failed to rollback stage: get-user');
      },
    });

    tx.addStage('get-another-user', {
      up: () => mockRequest('/users/5'),
      down: () => 'Rollback for get-another-user',
    });

    // This stage will fail
    tx.addStage('get-invalid-user', {
      up: () => mockRequest('/users/1'), // Their is no /users/1
      down: () => 'Oh no!',
    });

    tx.execute().catch(err => expect(err.message).to.be.a('string').that.equals('Failed to process stage get-invalid-user'));
  });
});
