/* eslint-disable no-await-in-loop */
/* eslint-disable no-unused-expressions */
const _ = require('lodash');
const chalk = require('chalk');

const {
  DEBUG,
} = process.env;

/**
 * Creates a sandbox which executes async actions in sequence rolling back
 * if any action fails and only completing successfully if all actions
 * are successful.
 * @author Christian Bartram
 */
class Transaction {
  constructor(stages = []) {
    if (!_.isArray(stages)) throw new Error('Param stages must be an Array');
    this.stages = stages;
  }

  /**
     * Adds a new stage to the transaction. A stage is an object which contains a name, and implementation/rollback steps for
     * a particular action
     * @param name String the name of the stage
     * @param impl Object Contains the name and implementation/rollback steps for the stage
     * { name: 'String', up: function, down: function }
     */
  addStage(name, impl) {
    if (_.isUndefined(name)) throw new Error('Your stage must have a unique name');
    if (_.isUndefined(impl.up) || _.isUndefined(impl.down)) throw new Error('Your stage implementation must have an up() and down() methods');
    if (this.stages.map(stage => stage.name).includes(name)) throw new Error('That stage name is already used in a previous stage please choose another.');
    const stage = {
      name,
      // We always wrap their implementation (up/down) in a promise
      up: data => Promise.resolve(impl.up(data)),
      down: data => Promise.resolve(impl.down(data)),
      before: (data) => {
        if (!_.isUndefined(impl.before)) return Promise.resolve(impl.before(data));
        return Promise.resolve(true);
      },
      after: (data) => {
        if (!_.isUndefined(impl.after)) return Promise.resolve(impl.after(data)); // This is a hook that runs if the up() is successful
        return Promise.resolve(true);
      },
    };

    this.stages.push(stage);
  }

  /**
     * Removes a stage from the list of stages to be
     * executed.
     * @param stageName String the name of the stage to be removed
     */
  removeStage(stageName) {
    if (_.isUndefined(stageName)) throw new Error('Cannot remove stage name of undefined');
    this.stages = this.stages.filter(({ name }) => name.toUpperCase() !== stageName.toUpperCase());
  }


  /**
     * Retrieves a specific stage given the stage name
     * @param stageName String the name of the stage to retrieve
     * @returns {*}
     */
  getStage(stageName) {
    if (_.isUndefined(stageName)) throw new Error('Cannot find stage name of undefined');
    return this.stages.find(stage => stage.name === stageName);
  }

  /**
     * Executes all the stages stopping and calling the down() method if any of the stages
     * fail. The down() method will revert
     * @returns {Promise<void>}
     */
  async execute() {
    const rollbacks = [];
    const data = {}; // Contains the data from all the previous stage's up() calls
    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      DEBUG && console.log(chalk.green('[INFO] Running Stage: ', stage.name));
      try {
        // We explicitly want to await these since we don't know if
        // we can continue to the next stage yet. Promise.All() is no good here
        await stage.before(data);
        const d = await stage.up(data);
        await stage.after(d);

        // We also push the current stages name and result to a
        // object and pass the stack to the up() function on the next iteration
        // that way the up() function always has access to all the previous stages results
        data[stage.name] = d;
        DEBUG && console.log(chalk.green(`[INFO] Stage ${stage.name} completed.`));
      } catch (err) {
        try {
          DEBUG && console.log(chalk.red(`[ERROR] Stage ${stage.name} failed. Rolling back`));
          DEBUG && console.log(chalk.red(err));
          // Recurse through the previous stages and call all of the down methods.
          while (i > 0) {
            if (i === -1) break;
            // If the first stage failed (i === 0) then attempt to roll it back
            // else roll back the stage before this one
            const rollbackStage = this.stages[i - 1];
            rollbacks.push(rollbackStage.down(data[this.stages[i - 1].name]));
            DEBUG && console.log(chalk.green('[INFO] Successfully Rolled back stage:', rollbackStage.name));
            i--;
          }

          // Stop processing more stages
          return Promise.all(rollbacks);
        } catch (error) {
          DEBUG && console.log(chalk.red('[ERROR] Failed to rollback Stage', stage.name));
          DEBUG && console.log(chalk.red(error));
          DEBUG && console.log(chalk.green('[INFO] Stopping Stages at:', stage.name));
          throw new Error(`Failed to process stage ${stage.name}`);
        }
      }
    }
    DEBUG && console.log(chalk.green('[INFO] Transaction Completed \u2713'));
    return data;
  }
}

module.exports = Transaction;
