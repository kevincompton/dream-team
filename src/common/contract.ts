import { ethers } from 'ethers';

export const KNOWLEDGE_POOL_ABI = [
  'function proposeKnowledge(string memory content) public returns (uint256)',
  'function validateKnowledge(uint256 id) public',
  'function executeKnowledge(uint256 id) public',
  'function getKnowledge(uint256 id) public view returns (address, string memory, uint256, bool, bool, address, address)',
  'function knowledgeCount() public view returns (uint256)',
  'function poolBalance() public view returns (uint256)',
  'function totalRewardPerTask() public view returns (uint256)',
  'event KnowledgeProposed(uint256 indexed id, address indexed proposer, string content)',
  'event KnowledgeValidated(uint256 indexed id, address indexed validator)',
  'event KnowledgeExecuted(uint256 indexed id, address indexed executor)',
];

export interface KnowledgeItem {
  proposer: string;
  content: string;
  timestamp: bigint;
  validated: boolean;
  executed: boolean;
  validator: string;
  executor: string;
}

export function parseKnowledgeItem(raw: ethers.Result): KnowledgeItem {
  return {
    proposer: raw[0] as string,
    content: raw[1] as string,
    timestamp: raw[2] as bigint,
    validated: raw[3] as boolean,
    executed: raw[4] as boolean,
    validator: raw[5] as string,
    executor: raw[6] as string,
  };
}

export function createKnowledgePoolContract(
  address: string,
  signerOrProvider: ethers.Signer | ethers.Provider,
): ethers.Contract {
  return new ethers.Contract(address, KNOWLEDGE_POOL_ABI, signerOrProvider);
}
