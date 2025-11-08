library IEEE;
use IEEE.std_logic_1164.all;
use IEEE.STD_LOGIC_ARITH.ALL;
use IEEE.STD_LOGIC_UNSIGNED.ALL;

-- Comment to change hash

entity top_entity is
    Port (
        -- Define top-level ports as needed, for example:
        operation : in STD_LOGIC_VECTOR(1 downto 0);
        input_one : in  STD_LOGIC_VECTOR(3 downto 0);
        input_two : in  STD_LOGIC_VECTOR(3 downto 0);
        --output : out  STD_LOGIC_VECTOR(3 downto 0);
        
        clk : in std_logic;
        an : out STD_LOGIC_VECTOR (3 downto 0);
        seg : out STD_LOGIC_VECTOR (6 downto 0);
        
        carry_out : out STD_LOGIC
    );
end top_entity;

architecture Structural of top_entity is


signal digit_out : std_logic_vector(15 downto 0);


component four_digit_driver is
    Port ( digit_one : std_logic_vector(3 downto 0);
           digit_two : std_logic_vector(3 downto 0);
           digit_three : std_logic_vector(3 downto 0);
           digit_four : std_logic_vector(3 downto 0);
           clock_100Mhz : in std_logic;
           Anode_Activate : out STD_LOGIC_VECTOR (3 downto 0);
           LED_out : out STD_LOGIC_VECTOR (6 downto 0)
           );
end component;



signal fa_output : STD_LOGIC_VECTOR(3 downto 0);
signal fa_carry_out : STD_LOGIC;

component four_bit_full_adder is
    Port (
        -- Define top-level ports as needed, for example:
        input_one : in  STD_LOGIC_VECTOR(3 downto 0);
        input_two : in  STD_LOGIC_VECTOR(3 downto 0);
        output : out  STD_LOGIC_VECTOR(3 downto 0);
        carry_out : out STD_LOGIC
    );
end component;

signal su_output : STD_LOGIC_VECTOR(3 downto 0);

component subtract is
	port (
    	input_one : in STD_LOGIC_VECTOR(3 downto 0);
        input_two : in STD_LOGIC_VECTOR(3 downto 0);
        output : out STD_LOGIC_VECTOR(3 downto 0));
end component;

signal comparator_value : STD_LOGIC_VECTOR(3 downto 0);
signal eq_out : STD_LOGIC;

component comparator is
	port (
    	input_one : in STD_LOGIC_VECTOR(3 downto 0);
        input_two : in STD_LOGIC_VECTOR(3 downto 0);
        output : out STD_LOGIC_VECTOR(3 downto 0);
        eq : out STD_LOGIC);
end component;

signal parity_out : STD_LOGIC;

component share_parity is
	port (
    	input_one : in STD_LOGIC_VECTOR(3 downto 0);
        input_two : in STD_LOGIC_VECTOR(3 downto 0);
        output : out STD_LOGIC);
end component;

begin

	U1: four_bit_full_adder port map (
    	input_one => input_one,
        input_two => input_two,
        output => fa_output,
        carry_out => fa_carry_out
    );
    
    U2: subtract port map(
    	input_one => input_two,
        input_two => input_one,
        output => su_output
    );
    
    U3: comparator port map(
		input_one => input_one,
        input_two => input_two,
        output => comparator_value,
        eq => eq_out
    );
    
    U4: share_parity port map(
    	input_one => input_one,
        input_two => input_two,
        output => parity_out
    );
    
    U5: four_digit_driver port map(
        digit_one => digit_out(15 downto 12),
        digit_two => digit_out(11 downto 8),
        digit_three => digit_out(7 downto 4),
        digit_four => digit_out(3 downto 0),
        clock_100Mhz => clk,
        Anode_Activate => an,
        LED_out => seg
    );

  digit_out(15 downto 12) <= input_two;
  digit_out(11 downto 8) <= input_one;
  
  digit_out(7 downto 4) <= x"0";

  digit_out(3 downto 0) <= fa_output when operation = "00" else 
                           su_output when operation = "01" else
                           comparator_value when operation = "10" else
                           (others => '0');

  carry_out <= fa_carry_out when operation = "00" else 
               '0' when operation = "01" else
               eq_out when operation = "10" else
               parity_out when operation = "11" else
               '0';

end Structural;
