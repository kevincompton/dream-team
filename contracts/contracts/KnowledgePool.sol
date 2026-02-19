// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title KnowledgePool
 * @dev Contrato principal para HIVE Protocol: pool de conocimiento con pagos
 *      automáticos (estilo HIP-991). Los agentes financian el pool y reciben
 *      HBAR al proponer, validar y ejecutar conocimiento.
 */
contract KnowledgePool {
    struct Knowledge {
        address proposer;
        string content;
        uint256 timestamp;
        bool validated;
        bool executed;
        address validator;
        address executor;
    }

    mapping(uint256 => Knowledge) public knowledgePool;
    uint256 public knowledgeCount;

    /// Recompensas en wei (HBAR nativo en Hedera EVM)
    uint256 public rewardProposer;
    uint256 public rewardValidator;
    uint256 public rewardExecutor;

    address public owner;

    event KnowledgeProposed(uint256 indexed id, address indexed proposer, string content);
    event KnowledgeValidated(uint256 indexed id, address indexed validator);
    event KnowledgeExecuted(uint256 indexed id, address indexed executor);
    event PoolFunded(address indexed from, uint256 amount);
    event RewardsPaid(
        uint256 indexed knowledgeId,
        address proposer,
        address validator,
        address executor,
        uint256 amountProposer,
        uint256 amountValidator,
        uint256 amountExecutor
    );
    event RewardsConfigured(uint256 proposer, uint256 validator, uint256 executor);

    error InsufficientPoolBalance();
    error TransferFailed();

    constructor(uint256 _rewardProposer, uint256 _rewardValidator, uint256 _rewardExecutor) {
        owner = msg.sender;
        rewardProposer = _rewardProposer;
        rewardValidator = _rewardValidator;
        rewardExecutor = _rewardExecutor;
        emit RewardsConfigured(_rewardProposer, _rewardValidator, _rewardExecutor);
    }

    /// Recibe HBAR para el pool (financiación colectiva de agentes)
    receive() external payable {
        emit PoolFunded(msg.sender, msg.value);
    }

    /// Financiación explícita del pool
    function fundPool() external payable {
        emit PoolFunded(msg.sender, msg.value);
    }

    /// Configura recompensas (solo owner)
    function setRewards(uint256 _rewardProposer, uint256 _rewardValidator, uint256 _rewardExecutor) external {
        require(msg.sender == owner, "Not owner");
        rewardProposer = _rewardProposer;
        rewardValidator = _rewardValidator;
        rewardExecutor = _rewardExecutor;
        emit RewardsConfigured(_rewardProposer, _rewardValidator, _rewardExecutor);
    }

    function proposeKnowledge(string memory content) public returns (uint256) {
        knowledgeCount++;
        knowledgePool[knowledgeCount] = Knowledge({
            proposer: msg.sender,
            content: content,
            timestamp: block.timestamp,
            validated: false,
            executed: false,
            validator: address(0),
            executor: address(0)
        });
        emit KnowledgeProposed(knowledgeCount, msg.sender, content);
        return knowledgeCount;
    }

    function validateKnowledge(uint256 id) public {
        require(id > 0 && id <= knowledgeCount, "Knowledge does not exist");
        require(!knowledgePool[id].executed, "Knowledge already executed");
        require(!knowledgePool[id].validated, "Knowledge already validated");

        knowledgePool[id].validated = true;
        knowledgePool[id].validator = msg.sender;
        emit KnowledgeValidated(id, msg.sender);
    }

    /**
     * @dev Ejecuta conocimiento validado y paga recompensas (pagos automáticos estilo HIP-991).
     *      Transfiere HBAR a proposer, validator y executor desde el pool.
     */
    function executeKnowledge(uint256 id) public {
        require(id > 0 && id <= knowledgeCount, "Knowledge does not exist");
        require(knowledgePool[id].validated, "Knowledge must be validated first");
        require(!knowledgePool[id].executed, "Knowledge already executed");

        uint256 total = rewardProposer + rewardValidator + rewardExecutor;
        if (address(this).balance < total) revert InsufficientPoolBalance();

        knowledgePool[id].executed = true;
        knowledgePool[id].executor = msg.sender;

        address payable p = payable(knowledgePool[id].proposer);
        address payable v = payable(knowledgePool[id].validator);
        address payable e = payable(msg.sender);

        if (rewardProposer > 0 && p != address(0)) _sendHBAR(p, rewardProposer);
        if (rewardValidator > 0 && v != address(0)) _sendHBAR(v, rewardValidator);
        if (rewardExecutor > 0 && e != address(0)) _sendHBAR(e, rewardExecutor);

        emit KnowledgeExecuted(id, msg.sender);
        emit RewardsPaid(id, p, v, e, rewardProposer, rewardValidator, rewardExecutor);
    }

    function _sendHBAR(address payable to, uint256 amount) private {
        (bool sent, ) = to.call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    /// Balance del pool (HBAR disponible para recompensas)
    function poolBalance() public view returns (uint256) {
        return address(this).balance;
    }

    /// Coste total por tarea ejecutada
    function totalRewardPerTask() public view returns (uint256) {
        return rewardProposer + rewardValidator + rewardExecutor;
    }

    function getKnowledge(uint256 id) public view returns (
        address proposer,
        string memory content,
        uint256 timestamp,
        bool validated,
        bool executed,
        address validator,
        address executor
    ) {
        require(id > 0 && id <= knowledgeCount, "Knowledge does not exist");
        Knowledge memory k = knowledgePool[id];
        return (k.proposer, k.content, k.timestamp, k.validated, k.executed, k.validator, k.executor);
    }
}
