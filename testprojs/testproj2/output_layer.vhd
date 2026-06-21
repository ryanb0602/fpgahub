library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity output_layer is
    Port ( 
        clk               : in  std_logic;
        reset_n           : in  std_logic;
        clear_acc         : in  std_logic;
        
        -- Serialized input from Hidden Layer
        pixel_broadcast   : in  std_logic;
        pixel_addr        : in  unsigned(8 downto 0);
        calc_enable       : in  std_logic;
        
        -- Training/Loading interface (10-bit to support IDs 512-521)
        train_we          : in  std_logic;
        train_neuron_sel  : in  unsigned(9 downto 0); 
        train_addr        : in  unsigned(9 downto 0);
        train_data_in     : in  std_logic_vector(7 downto 0);
        train_data_out : out std_logic_vector(7 downto 0);
        
        -- Results for the Argmax (10 digits)
        layer_out_signal  : out std_logic_vector(15 downto 0);
        layer_out_addr : in unsigned(3 downto 0)
    );
end output_layer;

architecture Behavioral of output_layer is

type score_array is array (0 to 9) of std_logic_vector(15 downto 0);
signal all_scores : score_array;

type weight_out_array is array (0 to 9) of std_logic_vector(7 downto 0);
signal all_weight_outs : weight_out_array;

begin

    -- Generate 10 neurons for digits 0-9
    GEN_NEURONS: for i in 0 to 9 generate
        signal neuron_we : std_logic;
    begin

        neuron_we <= '1' when (train_we = '1' and train_neuron_sel = to_unsigned(i + 256, 10)) else '0';
    
        U_NEURON : entity work.output_neuron
            generic map(
                NUM_WEIGHTS => 256
            )
            port map(
                clk          => clk,
                reset_n      => reset_n,
                clear_score  => clear_acc,
                
                pixel_in     => pixel_broadcast,
                addr_r       => pixel_addr,
                enable       => calc_enable,
                
                we           => neuron_we,
                addr_w       => train_addr,
                weight_in    => train_data_in,
                weight_out   => all_weight_outs(i),
                
                activation_o => open,
                score_o => all_scores(i)
            );
    end generate;
    
    layer_out_signal <= all_scores(to_integer(layer_out_addr));
    
    train_data_out <= all_weight_outs(to_integer(train_neuron_sel - 256)) 
                  when (train_neuron_sel >= 256 and train_neuron_sel <= 265) 
                  else (others => '0');

end Behavioral;