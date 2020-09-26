/* eslint-disable no-magic-numbers */
import nock from 'nock';
import {resolve} from 'path';
import {testEnv, spyOnStdout, getOctokit, generateContext, getApiFixture, disableNetConnect, stdoutContains, getLogStdout} from '@technote-space/github-action-test-helper';
import {Logger} from '@technote-space/github-action-log-helper';
import {getJobs, getJobConclusions, getWorkflowConclusion, execute} from '../src/process';

const rootDir        = resolve(__dirname, '..');
const fixtureRootDir = resolve(__dirname, 'fixtures');
const context        = generateContext({owner: 'hello', repo: 'world'});
const octokit        = getOctokit();
const logger         = new Logger();

describe('getJobs', () => {
  testEnv(rootDir);
  disableNetConnect(nock);

  it('should get jobs', async() => {
    process.env.GITHUB_RUN_ID = '123';
    nock('https://api.github.com')
      .persist()
      .get('/repos/hello/world/actions/runs/123/jobs')
      .reply(200, () => getApiFixture(fixtureRootDir, 'actions.list.jobs1'));

    const jobs = await getJobs(octokit, context);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toHaveProperty('id');
    expect(jobs[0]).toHaveProperty('status');
    expect(jobs[0]).toHaveProperty('conclusion');
  });
});

describe('getJobConclusions', () => {
  it('should get conclusions', () => {
    expect(getJobConclusions([
      {name: 'test1', conclusion: 'cancelled'},
      {name: 'test2', conclusion: 'neutral'},
      {name: 'test3', conclusion: 'failure'},
      {name: 'test4', conclusion: 'success'},
      {name: 'test5', conclusion: 'failure'},
      {name: 'test6', conclusion: 'success'},
      {name: 'test7', conclusion: 'cancelled'},
      {name: 'test8', conclusion: 'test1'},
      {name: 'test8', conclusion: 'test2'},
      {name: 'test8', conclusion: 'test3'},
    ])).toEqual([
      'cancelled',
      'neutral',
      'failure',
      'success',
      'test3',
    ]);
  });
});

describe('getWorkflowConclusion', () => {
  it('should get workflow conclusion', () => {
    expect(getWorkflowConclusion([])).toBe('failure');
    expect(getWorkflowConclusion([
      'neutral',
      'success',
      'cancelled',
    ])).toBe('cancelled');
  });
});

describe('execute', () => {
  testEnv(rootDir);
  disableNetConnect(nock);

  it('should get payload 1', async() => {
    process.env.GITHUB_RUN_ID = '123';
    const mockStdout          = spyOnStdout();
    nock('https://api.github.com')
      .persist()
      .get('/repos/hello/world/actions/runs/123/jobs')
      .reply(200, () => getApiFixture(fixtureRootDir, 'actions.list.jobs1'));

    await execute(logger, octokit, context);

    stdoutContains(mockStdout, [
      '::group::Jobs:',
      '::group::Conclusions:',
      getLogStdout(['success']),
      '::group::Conclusion:',
      '"success"',
      '::set-output name=conclusion::success',
      '::set-env name=WORKFLOW_CONCLUSION::success',
    ]);
  });

  it('should get payload 2', async() => {
    process.env.GITHUB_RUN_ID = '123';
    const mockStdout          = spyOnStdout();
    nock('https://api.github.com')
      .persist()
      .get('/repos/hello/world/actions/runs/123/jobs')
      .reply(200, () => getApiFixture(fixtureRootDir, 'actions.list.jobs2'));

    await execute(logger, octokit, context);

    stdoutContains(mockStdout, [
      '::group::Jobs:',
      '::group::Conclusions:',
      getLogStdout(['success', 'cancelled']),
      '::group::Conclusion:',
      '"cancelled"',
      '::set-output name=conclusion::cancelled',
      '::set-env name=WORKFLOW_CONCLUSION::cancelled',
    ]);
  });

  it('should get payload 3', async() => {
    process.env.GITHUB_RUN_ID = '123';
    const mockStdout          = spyOnStdout();
    nock('https://api.github.com')
      .persist()
      .get('/repos/hello/world/actions/runs/123/jobs')
      .reply(200, () => getApiFixture(fixtureRootDir, 'actions.list.jobs3'));

    await execute(logger, octokit, context);

    stdoutContains(mockStdout, [
      '::group::Jobs:',
      '::group::Conclusions:',
      getLogStdout(['failure', 'cancelled', 'success']),
      '::group::Conclusion:',
      '"failure"',
      '::set-output name=conclusion::failure',
      '::set-env name=WORKFLOW_CONCLUSION::failure',
    ]);
  });

  it('should get payload without env', async() => {
    process.env.GITHUB_RUN_ID      = '123';
    process.env.INPUT_SET_ENV_NAME = '';
    const mockStdout               = spyOnStdout();
    nock('https://api.github.com')
      .persist()
      .get('/repos/hello/world/actions/runs/123/jobs')
      .reply(200, () => getApiFixture(fixtureRootDir, 'actions.list.jobs1'));

    await execute(logger, octokit, context);

    stdoutContains(mockStdout, [
      '::group::Jobs:',
      '::group::Conclusions:',
      getLogStdout(['success']),
      '::group::Conclusion:',
      '"success"',
      '::set-output name=conclusion::success',
    ]);
  });
});
