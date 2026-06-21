library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity output_neuron is
    Generic (
        NUM_WEIGHTS : integer := 512; -- Fixed for the Hidden-to-Output connection
        NEURON_ID   : integer := 0
    );
    Port ( 
        clk         : in  std_logic;
        reset_n     : in  std_logic;
        clear_score : in  std_logic;
        
        -- Forward Pass (Serialized input from Hidden Layer)
        pixel_in    : in  std_logic;
        addr_r      : in  unsigned(8 downto 0);
        enable      : in  std_logic;
        
        -- Training/Loading Interface
        we          : in  std_logic;
        addr_w      : in  unsigned(9 downto 0);
        weight_in   : in  std_logic_vector(7 downto 0);
        weight_out  : out std_logic_vector(7 downto 0);
        
        -- Neuron Outputs
        activation_o : out std_logic;
        score_o      : out std_logic_vector(15 downto 0) -- Raw score for Argmax
    );
end output_neuron;

architecture Behavioral of output_neuron is

    signal current_score : signed(15 downto 0) := (others => '0');
    signal bin_weight    : std_logic;
    signal padded_addr_r : unsigned(9 downto 0);

begin

    padded_addr_r <= '0' & addr_r;

    WEIGHTS : entity work.weight_bram
        generic map (
            NUM_WEIGHTS => NUM_WEIGHTS
        )
        port map (
            clk         => clk, 
            we          => we, 
            addr_w      => addr_w,
            data_in     => weight_in, 
            data_out_8b => weight_out,
            addr_r      => padded_addr_r,
            bin_out     => bin_weight
        );

    -- Accumulation Process (Forward Pass)
    process (clk)
    begin
        if rising_edge(clk) then
            if reset_n = '0' then
                current_score <= (others => '0');
            elsif clear_score = '1' then
                current_score <= (others => '0');
            elsif enable = '1' then
                -- Standard BNN comparison logic
                if pixel_in = bin_weight then
                    current_score <= current_score + 1;
                else
                    current_score <= current_score - 1;
                end if;
            end if;
        end if;
    end process;
    
    -- Binary activation (for diagnostic or basic classification)
    activation_o <= '1' when current_score >= 0 else '0';
    
    -- Expose the raw integer score for the Argmax module
    score_o <= std_logic_vector(current_score);

end Behavioral;