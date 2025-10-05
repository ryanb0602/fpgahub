library IEEE;
use IEEE.std_logic_1164.all;

entity full_adder is
	port (
    	A, B, Cin : in STD_LOGIC;
        Sum, Cout : out STD_LOGIC);
end full_adder;


architecture Behavioral of full_adder is
begin

	Sum <= A xor B xor Cin;
    Cout <= (A and B) or (A and Cin) or (B and Cin);

end architecture Behavioral;