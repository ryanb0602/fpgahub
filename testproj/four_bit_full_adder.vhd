library IEEE;
use IEEE.std_logic_1164.all;

entity four_bit_full_adder is
    Port (
        -- Define top-level ports as needed, for example:
        input_one : in  STD_LOGIC_VECTOR(3 downto 0);
        input_two : in  STD_LOGIC_VECTOR(3 downto 0);
        output : out  STD_LOGIC_VECTOR(3 downto 0);
        carry_out : out STD_LOGIC
    );
end four_bit_full_adder;

architecture Structural of four_bit_full_adder is

	signal carrys : STD_LOGIC_VECTOR(0 to 2);

    -- Component declaration for the full adder.
    component full_adder
        Port (
            A, B, Cin : in  STD_LOGIC;
            Sum, Cout : out STD_LOGIC
        );
    end component;

begin

    -- Instantiate the full_adder component.
    U1: full_adder port map (
        A    => input_one(0),
        B    => input_two(0),
        Cin  => '0',
        Sum  => output(0),
        Cout => carrys(0)
    );
    
    U2: full_adder port map (
        A    => input_one(1),
        B    => input_two(1),
        Cin  => carrys(0),
        Sum  => output(1),
        Cout => carrys(1)
    );
    
    U3: full_adder port map (
        A    => input_one(2),
        B    => input_two(2),
        Cin  => carrys(1),
        Sum  => output(2),
        Cout => carrys(2)
    );
    
    U4: full_adder port map (
        A    => input_one(3),
        B    => input_two(3),
        Cin  => carrys(2),
        Sum  => output(3),
        Cout => carry_out
    );

end Structural;
