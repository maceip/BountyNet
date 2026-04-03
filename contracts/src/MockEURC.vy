# @version ^0.4.0
# @title Mock EURC for testing
# @dev Mintable ERC-20, 6 decimals

name: public(constant(String[16])) = "Euro Coin"
symbol: public(constant(String[8])) = "EURC"
decimals: public(constant(uint8)) = 6

totalSupply: public(uint256)
balanceOf: public(HashMap[address, uint256])
allowance: public(HashMap[address, HashMap[address, uint256]])

event Transfer:
    sender: indexed(address)
    receiver: indexed(address)
    amount: uint256

event Approval:
    owner: indexed(address)
    spender: indexed(address)
    amount: uint256

@deploy
def __init__():
    pass

@external
def mint(to: address, amount: uint256):
    self.balanceOf[to] += amount
    self.totalSupply += amount
    log Transfer(sender=empty(address), receiver=to, amount=amount)

@external
def approve(spender: address, amount: uint256) -> bool:
    self.allowance[msg.sender][spender] = amount
    log Approval(owner=msg.sender, spender=spender, amount=amount)
    return True

@external
def transfer(receiver: address, amount: uint256) -> bool:
    self.balanceOf[msg.sender] -= amount
    self.balanceOf[receiver] += amount
    log Transfer(sender=msg.sender, receiver=receiver, amount=amount)
    return True

@external
def transferFrom(sender: address, receiver: address, amount: uint256) -> bool:
    self.allowance[sender][msg.sender] -= amount
    self.balanceOf[sender] -= amount
    self.balanceOf[receiver] += amount
    log Transfer(sender=sender, receiver=receiver, amount=amount)
    return True
