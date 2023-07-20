import type {
  ContractFuture,
  IgnitionModuleResult,
  ModuleParameters,
} from "../types/module";
import type { IgnitionModuleDefinition } from "../types/module-builder";

import { isContractFuture } from "../type-guards";
import { Artifact, ArtifactResolver } from "../types/artifact";
import { DeployConfig, DeploymentResult } from "../types/deployer";
import { DeploymentLoader } from "../types/deployment-loader";
import { Journal } from "../types/journal";

import { Batcher } from "./batcher";
import { ExecutionEngine } from "./execution/execution-engine";
import { executionStateReducer } from "./execution/execution-state-reducer";
import { BasicExecutionStrategy } from "./execution/execution-strategy";
import { TranactionLookupTimerImpl } from "./execution/transaction-lookup-timer";
import { ModuleConstructor } from "./module-builder";
import { Reconciler } from "./reconciliation/reconciler";
import { ArtifactMap } from "./reconciliation/types";
import { isContractExecutionStateArray } from "./type-guards";
import { ChainDispatcher } from "./types/chain-dispatcher";
import { ExecutionStrategy } from "./types/execution-engine";
import {
  ContractAtExecutionState,
  DeploymentExecutionState,
  ExecutionStateMap,
} from "./types/execution-state";
import { TransactionLookupTimer } from "./types/transaction-timer";
import { assertIgnitionInvariant } from "./utils/assertions";
import { getFuturesFromModule } from "./utils/get-futures-from-module";
import { validate } from "./validation/validate";

// The interval between checks to see if a new block has been created
const DEFAULT_BLOCK_POLLING_INTERVAL = 200;

// In milliseconds the amount of time to wait on a transaction to
// confirm before timing out
const DEFAULT_TRANSACTION_TIMEOUT_INTERVAL = 3 * 60 * 1000;

/**
 * Run an Igntition deployment.
 *
 * @beta
 */
export class Deployer {
  private _config: DeployConfig;
  private _moduleConstructor: ModuleConstructor;
  private _executionEngine: ExecutionEngine;
  private _strategy: ExecutionStrategy;
  private _artifactResolver: ArtifactResolver;
  private _deploymentLoader: DeploymentLoader;
  private _chainDispatcher: ChainDispatcher;
  private _transactionLookupTimer: TransactionLookupTimer;

  constructor(options: {
    config?: Partial<DeployConfig>;
    artifactResolver: ArtifactResolver;
    deploymentLoader: DeploymentLoader;
    chainDispatcher: ChainDispatcher;
  }) {
    this._config = {
      blockPollingInterval: DEFAULT_BLOCK_POLLING_INTERVAL,
      transactionTimeoutInterval: DEFAULT_TRANSACTION_TIMEOUT_INTERVAL,
      ...options.config,
    };

    this._strategy = new BasicExecutionStrategy();
    this._artifactResolver = options.artifactResolver;
    this._deploymentLoader = options.deploymentLoader;

    this._chainDispatcher = options.chainDispatcher;

    this._moduleConstructor = new ModuleConstructor();
    this._executionEngine = new ExecutionEngine();
    this._transactionLookupTimer = new TranactionLookupTimerImpl(
      this._config.transactionTimeoutInterval
    );
  }

  public async deploy(
    moduleDefinition: IgnitionModuleDefinition<
      string,
      string,
      IgnitionModuleResult<string>
    >,
    deploymentParameters: { [key: string]: ModuleParameters },
    accounts: string[]
  ): Promise<DeploymentResult> {
    const module = this._moduleConstructor.construct(moduleDefinition);

    await validate(module, this._artifactResolver, deploymentParameters);

    const previousStateMap = await this._loadExecutionStateFrom(
      this._deploymentLoader.journal
    );

    const contracts = getFuturesFromModule(module).filter(isContractFuture);
    const contractStates = contracts
      .map((contract) => previousStateMap[contract.id])
      .filter((v) => v !== undefined);

    // realistically this should be impossible to fail.
    // just need it here for the type inference
    assertIgnitionInvariant(
      isContractExecutionStateArray(contractStates),
      "Invalid state map"
    );

    // since the reconciler is purely synchronous, we load all of the artifacts at once here.
    // if reconciler was async, we could pass it the artifact loaders and load them JIT instead.
    const moduleArtifactMap = await this._loadModuleArtifactMap(contracts);
    const storedArtifactMap = await this._loadStoredArtifactMap(contractStates);

    const reconciliationResult = Reconciler.reconcile(
      module,
      previousStateMap,
      deploymentParameters,
      accounts,
      moduleArtifactMap,
      storedArtifactMap
    );

    if (reconciliationResult.reconciliationFailures.length > 0) {
      // TODO: Provide more information
      throw new Error("Reconciliation failed");
    }

    if (reconciliationResult.missingExecutedFutures.length > 0) {
      // TODO: indicate to UI that warnings should be shown
    }

    const batches = Batcher.batch(module, previousStateMap);

    return this._executionEngine.execute({
      config: this._config,
      block: { number: -1, hash: "-" },
      strategy: this._strategy,
      artifactResolver: this._artifactResolver,
      batches,
      module,
      executionStateMap: previousStateMap,
      accounts,
      deploymentParameters,
      deploymentLoader: this._deploymentLoader,
      chainDispatcher: this._chainDispatcher,
      transactionLookupTimer: this._transactionLookupTimer,
    });
  }

  private async _loadExecutionStateFrom(
    journal: Journal
  ): Promise<ExecutionStateMap> {
    let state: ExecutionStateMap = {};

    for await (const message of journal.read()) {
      state = executionStateReducer(state, message);
    }

    return state;
  }

  private async _loadModuleArtifactMap(
    contracts: Array<ContractFuture<string>>
  ): Promise<ArtifactMap> {
    const entries: Array<[string, Artifact]> = [];

    for (const contract of contracts) {
      const artifact = await this._artifactResolver.loadArtifact(
        contract.contractName
      );

      entries.push([contract.id, artifact]);
    }

    return Object.fromEntries(entries);
  }

  private async _loadStoredArtifactMap(
    contractStates: Array<DeploymentExecutionState | ContractAtExecutionState>
  ): Promise<ArtifactMap> {
    const entries: Array<[string, Artifact]> = [];

    for (const contract of contractStates) {
      const artifact = await this._deploymentLoader.loadArtifact(
        contract.artifactFutureId
      );

      entries.push([contract.id, artifact]);
    }

    return Object.fromEntries(entries);
  }
}
