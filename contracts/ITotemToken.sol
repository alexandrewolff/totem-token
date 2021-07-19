// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITotemToken {
    function mintFromBridge(address account, uint256 amount) external;

    function burnFromBridge(address account, uint256 amount) external;
}
