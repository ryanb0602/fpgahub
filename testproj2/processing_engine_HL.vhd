library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

use IEEE.NUMERIC_STD.ALL;


entity processing_engine_HL is
  Generic (
    NUM_NEURONS : integer := 16 --going to do 16 neurons per processing unit, means there will be 32 processing units
  );
  Port ( 
    clk : in std_logic;
    reset_n : in std_logic;
    clear_acc : in std_logic;
    
    pixel_in : in std_logic;
    pixel_addr : in unsigned(9 downto 0);
    calc_enable : in std_logic;
    
    neuron_select : in unsigned(3 downto 0);
    
    weight_we : in std_logic;
    weight_addr_w : in unsigned(9 downto 0);
    weight_data_8b : in std_logic_vector(7 downto 0);
    weight_data_out_8b : out std_logic_vector(7 downto 0);
    
    pe_activations_out : out std_logic_vector(15 downto 0)
  );
end processing_engine_HL;

architecture Behavioral of processing_engine_HL is
    signal wide_weight_bus : std_logic_vector(127 downto 0);  
    
    signal wide_weight_in : std_logic_vector(127 downto 0);
    signal wide_weight_en : std_logic_vector(15 downto 0);
begin

    process(neuron_select, weight_we)
    begin
        wide_weight_en <= (others => '0'); -- Default: No writing
        if weight_we = '1' then
            -- Set only the bit corresponding to the chosen neuron
            wide_weight_en(to_integer(neuron_select)) <= '1';
        end if;
    end process;

    GEN_DATA: for i in 0 to 15 generate
            wide_weight_in((i*8)+7 downto (i*8)) <= weight_data_8b;
    end generate;
                        
    

    GEN_NEURONS: for i in 0 to 15 generate  
    begin
        U_HIDDEN_NEURON: entity work.neuron
            port map (
                clk          => clk,
                reset_n      => reset_n,
                clear_score  => clear_acc,
                pixel_in     => pixel_in,
                addr_r       => pixel_addr,
                enable       => calc_enable,
                
                -- Slice the bus: take the MSB (sign bit) of the i-th 8-bit weight
                -- i=0: bit 7, i=1: bit 15, i=2: bit 23...
                weight_in    => wide_weight_bus((i*8) + 7),
                
                activation_o => pe_activations_out(i) 
            );
    end generate;
    
    U_WEIGHT_BLOCK: entity work.pe_bram
        generic map (
            NUM_WEIGHTS => 784
        )
        port map (
            clk         => clk,
            we          => wide_weight_en,
            addr_w      => weight_addr_w,
            data_in     => wide_weight_in,
            data_out_8b => open,
            
            addr_r      => pixel_addr,
            dout_wide   => wide_weight_bus
        );
        
        weight_data_out_8b <= wide_weight_bus((to_integer(neuron_select)*8)+7 downto (to_integer(neuron_select)*8));

end Behavioral;
