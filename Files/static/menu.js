$(document).ready(function(){
    $('.menuItem').mouseenter(
        function() {
            $(".dropItem", this ).animate({
                top:"100%"   
            }, 500, function() {
                // Animation complete.
            });
        }
    );
    $('.menuItem').mouseleave(
         function() {
             $(".dropItem", this ).animate({
                 top:"0%"   
             }, 100, function() {
                 // Animation complete.
             });
         }
     )
});