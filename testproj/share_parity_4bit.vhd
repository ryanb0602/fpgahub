library IEEE;
use IEEE.std_logic_1164.all;

entity share_parity is
	port (
    	input_one : in STD_LOGIC_VECTOR(3 downto 0);
        input_two : in STD_LOGIC_VECTOR(3 downto 0);
        output : out STD_LOGIC);
end share_parity;


architecture Behavioral of share_parity is

signal one_parity, two_parity : STD_LOGIC;

begin

	one_parity <= input_one(0) XOR input_one(1) XOR input_one(2) XOR input_one(3);
    two_parity <= input_two(0) XOR input_two(1) XOR input_two(2) XOR input_two(3);
    
    output <= one_parity XNOR two_parity;

end Behavioral;